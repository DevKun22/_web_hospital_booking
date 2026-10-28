import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import SearchIndexer from "./search/search.indexer.js";

type PackageItemInput = {
  name: string;
  description?: string | null;
  price?: number;
  included?: boolean;
  order?: number;
};

type CreatePackageInput = {
  name: string;
  slug?: string;
  description?: string | null;
  departmentId?: string | null;
  basePrice: number;
  serviceFee?: number;
  summary?: string | null;
  note?: string | null;
  isPopular?: boolean;
  isBHYTSupport?: boolean;
  isActive?: boolean;
  items?: PackageItemInput[];
};

type UpdatePackageInput = {
  name?: string;
  slug?: string | null;
  description?: string | null;
  departmentId?: string | null;
  basePrice?: number;
  serviceFee?: number;
  summary?: string | null;
  note?: string | null;
  isPopular?: boolean;
  isBHYTSupport?: boolean;
  isActive?: boolean;
};

const packageSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  departmentId: true,
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  basePrice: true,
  serviceFee: true,
  summary: true,
  note: true,
  isPopular: true,
  isBHYTSupport: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: {
      order: "asc",
    },
  },
  _count: {
    select: {
      appointments: true,
    },
  },
} satisfies Prisma.PackageSelect;

const publicPackageSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  basePrice: true,
  serviceFee: true,
  summary: true,
  note: true,
  isPopular: true,
  isBHYTSupport: true,
  items: {
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      included: true,
      order: true,
    },
    orderBy: {
      order: "asc",
    },
  },
} satisfies Prisma.PackageSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

const getIncludedItemsTotal = (
  items?: { price: number; included: boolean }[],
) =>
  items
    ?.filter((item) => item.included)
    .reduce((total, item) => total + item.price, 0) || 0;

const withFinalPrice = <
  T extends {
    basePrice: number;
    serviceFee: number;
    items?: { price: number; included: boolean }[];
  },
>(
  item: T,
) => {
  const includedItemsTotal = getIncludedItemsTotal(item.items);
  const packageBasePrice = includedItemsTotal || item.basePrice;

  return {
    ...item,
    basePrice: packageBasePrice,
    includedItemsTotal,
    finalPrice: packageBasePrice + item.serviceFee,
  };
};

class PackageService {
  async list(query: {
    search?: string;
    isActive?: boolean;
    isPopular?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PackageWhereInput = {
      isActive: query.isActive,
      isPopular: query.isPopular,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.package.findMany({
        where,
        select: packageSelect,
        orderBy: [{ isPopular: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.package.count({ where }),
    ]);

    return {
      items: items.map(withFinalPrice),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const packageItem = await prisma.package.findUnique({
      where: { id },
      select: packageSelect,
    });

    if (!packageItem) {
      throw new AppError("Không tìm thấy gói khám", 404);
    }

    await SearchIndexer.syncPackage(packageItem.id);

    return withFinalPrice(packageItem);
  }

  async create(input: CreatePackageInput) {
    const slug = input.slug ? createSlug(input.slug) : createSlug(input.name);

    await this.ensureUniquePackage({ name: input.name, slug });
    await this.ensureDepartmentExists(input.departmentId);

    const packageItem = await prisma.package.create({
      data: {
        name: input.name,
        slug,
        description: normalizeOptionalString(input.description),
        departmentId: normalizeOptionalString(input.departmentId),
        basePrice: input.basePrice,
        serviceFee: input.serviceFee ?? 0,
        summary: normalizeOptionalString(input.summary),
        note: normalizeOptionalString(input.note),
        isPopular: input.isPopular ?? false,
        isBHYTSupport: input.isBHYTSupport ?? false,
        isActive: input.isActive ?? true,
        items: input.items?.length
          ? {
              create: input.items.map((item, index) => ({
                name: item.name,
                description: normalizeOptionalString(item.description),
                price: item.price ?? 0,
                included: item.included ?? true,
                order: item.order ?? index,
              })),
            }
          : undefined,
      },
      select: packageSelect,
    });

    await SearchIndexer.syncPackage(packageItem.id);

    return withFinalPrice(packageItem);
  }

  async update(id: string, input: UpdatePackageInput) {
    await this.getById(id);

    const nextSlug =
      input.slug === null
        ? null
        : input.slug
          ? createSlug(input.slug)
          : input.name
            ? createSlug(input.name)
            : undefined;

    if (input.name || nextSlug) {
      await this.ensureUniquePackage({
        name: input.name,
        slug: nextSlug || undefined,
        excludeId: id,
      });
    }

    await this.ensureDepartmentExists(input.departmentId);

    const packageItem = await prisma.package.update({
      where: { id },
      data: {
        name: input.name,
        slug: nextSlug,
        description: normalizeOptionalString(input.description),
        departmentId: normalizeOptionalString(input.departmentId),
        basePrice: input.basePrice,
        serviceFee: input.serviceFee,
        summary: normalizeOptionalString(input.summary),
        note: normalizeOptionalString(input.note),
        isPopular: input.isPopular,
        isBHYTSupport: input.isBHYTSupport,
        isActive: input.isActive,
      },
      select: packageSelect,
    });

    return withFinalPrice(packageItem);
  }

  async delete(id: string) {
    const packageItem = await this.getById(id);

    if (packageItem._count.appointments > 0) {
      throw new AppError("Không thể xóa gói khám đã có lịch hẹn", 409);
    }

    await prisma.package.delete({
      where: { id },
    });

    await SearchIndexer.remove("package", id);

    return packageItem;
  }

  async createItem(packageId: string, input: PackageItemInput) {
    await this.getById(packageId);

    const item = await prisma.packageItem.create({
      data: {
        packageId,
        name: input.name,
        description: normalizeOptionalString(input.description),
        price: input.price ?? 0,
        included: input.included ?? true,
        order: input.order ?? 0,
      },
    });

    await SearchIndexer.syncPackage(packageId);

    return item;
  }

  async updateItem(
    packageId: string,
    itemId: string,
    input: Partial<PackageItemInput>,
  ) {
    await this.getById(packageId);
    await this.getItem(packageId, itemId);

    const item = await prisma.packageItem.update({
      where: { id: itemId },
      data: {
        name: input.name,
        description: normalizeOptionalString(input.description),
        price: input.price,
        included: input.included,
        order: input.order,
      },
    });

    await SearchIndexer.syncPackage(packageId);

    return item;
  }

  async deleteItem(packageId: string, itemId: string) {
    await this.getById(packageId);
    const item = await this.getItem(packageId, itemId);

    await prisma.packageItem.delete({
      where: { id: itemId },
    });

    await SearchIndexer.syncPackage(packageId);

    return item;
  }

  async publicList(query: {
    search?: string;
    isPopular?: boolean;
    limit?: number;
  }) {
    const where: Prisma.PackageWhereInput = {
      isActive: true,
      isPopular: query.isPopular,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const packages = await prisma.package.findMany({
      where,
      select: publicPackageSelect,
      orderBy: [{ isPopular: "desc" }, { basePrice: "asc" }],
      take: query.limit
        ? Math.min(Math.max(Math.trunc(query.limit), 1), 50)
        : undefined,
    });

    return packages.map(withFinalPrice);
  }

  async publicCatalog(query: {
    search?: string;
    departmentId?: string;
    isPopular?: boolean;
    isBhytSupport?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Math.trunc(query.page || 1), 1);
    const limit = Math.min(Math.max(Math.trunc(query.limit || 10), 1), 50);
    const where: Prisma.PackageWhereInput = {
      isActive: true,
      isPopular: query.isPopular,
      isBHYTSupport: query.isBhytSupport,
      departmentId: query.departmentId,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
        { department: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [packages, total] = await prisma.$transaction([
      prisma.package.findMany({
        where,
        select: publicPackageSelect,
        orderBy: [{ isPopular: "desc" }, { basePrice: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.package.count({ where }),
    ]);

    return {
      items: packages.map(withFinalPrice),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async publicGetBySlug(slug: string) {
    const packageItem = await prisma.package.findFirst({
      where: {
        slug,
        isActive: true,
      },
      select: publicPackageSelect,
    });

    if (!packageItem) {
      throw new AppError("Không tìm thấy gói khám", 404);
    }

    return withFinalPrice(packageItem);
  }

  private async getItem(packageId: string, itemId: string) {
    const item = await prisma.packageItem.findFirst({
      where: {
        id: itemId,
        packageId,
      },
    });

    if (!item) {
      throw new AppError("Không tìm thấy hạng mục gói khám", 404);
    }

    return item;
  }

  private async ensureUniquePackage(input: {
    name?: string;
    slug?: string;
    excludeId?: string;
  }) {
    const existingPackage = await prisma.package.findFirst({
      where: {
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        OR: [
          ...(input.name ? [{ name: input.name }] : []),
          ...(input.slug ? [{ slug: input.slug }] : []),
        ],
      },
      select: { id: true },
    });

    if (existingPackage) {
      throw new AppError("Tên hoặc slug gói khám đã tồn tại", 409);
    }
  }

  private async ensureDepartmentExists(departmentId?: string | null) {
    if (!departmentId) return;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      throw new AppError("Không tìm thấy chuyên khoa", 404);
    }
  }
}

export default new PackageService();

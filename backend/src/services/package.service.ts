import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import { publicCompletePackageWhere } from "./publicCatalogEligibility.js";

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

    return item;
  }

  async deleteItem(packageId: string, itemId: string) {
    await this.getById(packageId);
    const item = await this.getItem(packageId, itemId);

    await prisma.packageItem.delete({
      where: { id: itemId },
    });

    return item;
  }

  async publicList(query: {
    search?: string;
    isPopular?: boolean;
    limit?: number;
    featured?: boolean;
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

    if (query.featured) {
      where.AND = [publicCompletePackageWhere];
    }

    const packages = await prisma.package.findMany({
      where,
      select: publicPackageSelect,
      orderBy: query.featured
        ? [
            { isPopular: "desc" },
            { isBHYTSupport: "desc" },
            { updatedAt: "desc" },
            { basePrice: "asc" },
          ]
        : [{ isPopular: "desc" }, { basePrice: "asc" }],
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
    sort?: "POPULAR_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC";
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
      AND: [publicCompletePackageWhere],
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { note: { contains: query.search, mode: "insensitive" } },
        { department: { name: { contains: query.search, mode: "insensitive" } } },
        {
          items: {
            some: {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                {
                  description: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
      ];
    }

    const [matchingPackages, allPackages] = await prisma.$transaction([
      prisma.package.findMany({
        where,
        select: publicPackageSelect,
      }),
      prisma.package.findMany({
        where: {
          isActive: true,
          AND: [publicCompletePackageWhere],
        },
        select: publicPackageSelect,
        orderBy: [{ isPopular: "desc" }, { basePrice: "asc" }],
      }),
    ]);

    const normalizedPackages = matchingPackages.map(withFinalPrice);
    const sort = query.sort || "POPULAR_DESC";
    normalizedPackages.sort((left, right) => {
      if (sort === "PRICE_ASC") return left.finalPrice - right.finalPrice;
      if (sort === "PRICE_DESC") return right.finalPrice - left.finalPrice;
      if (sort === "NAME_ASC") return left.name.localeCompare(right.name, "vi");

      if (left.isPopular !== right.isPopular) {
        return Number(right.isPopular) - Number(left.isPopular);
      }

      return left.finalPrice - right.finalPrice;
    });

    const total = normalizedPackages.length;
    const catalogPackages = allPackages.map(withFinalPrice);
    const prices = catalogPackages.map((item) => item.finalPrice);
    const departments = Array.from(
      new Map(
        catalogPackages
          .filter((item) => item.department)
          .map((item) => [item.department!.id, item.department!]),
      ).values(),
    ).sort((left, right) => left.name.localeCompare(right.name, "vi"));
    const items = normalizedPackages.slice((page - 1) * limit, page * limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        packageCount: catalogPackages.length,
        popularCount: catalogPackages.filter((item) => item.isPopular).length,
        bhytSupportCount: catalogPackages.filter((item) => item.isBHYTSupport)
          .length,
        departmentCount: departments.length,
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
      },
      filters: {
        departments,
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

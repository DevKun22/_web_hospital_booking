import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import MediaAssetService from "./mediaAsset.service.js";

type CreateDepartmentInput = {
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  imageAssetId?: string;
  symptomKeywords?: string[];
  triageDescription?: string | null;
  isTriageFallback?: boolean;
  isActive?: boolean;
};

type UpdateDepartmentInput = {
  name?: string;
  slug?: string | null;
  description?: string | null;
  image?: string | null;
  imageAssetId?: string | null;
  symptomKeywords?: string[];
  triageDescription?: string | null;
  isTriageFallback?: boolean;
  isActive?: boolean;
};

const departmentSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  symptomKeywords: true,
  triageDescription: true,
  isTriageFallback: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      doctors: true,
      appointments: true,
    },
  },
} satisfies Prisma.DepartmentSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

class DepartmentService {
  async list(query: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DepartmentWhereInput = {
      isActive: query.isActive,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
        {
          triageDescription: {
            contains: query.search,
            mode: "insensitive",
          },
        },
        { symptomKeywords: { has: query.search } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.department.findMany({
        where,
        select: departmentSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.department.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      select: departmentSelect,
    });

    if (!department) {
      throw new AppError("Không tìm thấy chuyên khoa", 404);
    }

    return department;
  }

  async create(input: CreateDepartmentInput) {
    const slug = input.slug ? createSlug(input.slug) : createSlug(input.name);
    const imageAsset = input.imageAssetId
      ? await MediaAssetService.getUsableAsset(input.imageAssetId)
      : null;

    const existingDepartment = await prisma.department.findFirst({
      where: {
        OR: [{ name: input.name }, { slug }],
      },
      select: { id: true },
    });

    if (existingDepartment) {
      throw new AppError("Tên hoặc slug chuyên khoa đã tồn tại", 409);
    }

    const department = await prisma.department.create({
      data: {
        name: input.name,
        slug,
        description: normalizeOptionalString(input.description),
        image: imageAsset?.url || normalizeOptionalString(input.image),
        symptomKeywords: input.symptomKeywords || [],
        triageDescription: normalizeOptionalString(input.triageDescription),
        isTriageFallback: input.isTriageFallback ?? false,
        isActive: input.isActive ?? true,
      },
      select: departmentSelect,
    });

    if (department.isTriageFallback) {
      await prisma.department.updateMany({
        where: { id: { not: department.id }, isTriageFallback: true },
        data: { isTriageFallback: false },
      });
    }

    if (imageAsset) {
      await MediaAssetService.attachAsset(
        imageAsset.id,
        "DEPARTMENT",
        department.id,
      );
    }

    return department;
  }

  async update(id: string, input: UpdateDepartmentInput) {
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
      const existingDepartment = await prisma.department.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(input.name ? [{ name: input.name }] : []),
            ...(nextSlug ? [{ slug: nextSlug }] : []),
          ],
        },
        select: { id: true },
      });

      if (existingDepartment) {
        throw new AppError("Tên hoặc slug chuyên khoa đã tồn tại", 409);
      }
    }

    const imageAsset =
      input.imageAssetId === null
        ? null
        : input.imageAssetId
          ? await MediaAssetService.attachAsset(
              input.imageAssetId,
              "DEPARTMENT",
              id,
            )
          : undefined;

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: input.name,
        slug: nextSlug,
        description: normalizeOptionalString(input.description),
        image:
          input.imageAssetId === null
            ? null
            : imageAsset
              ? imageAsset.url
              : normalizeOptionalString(input.image),
        symptomKeywords: input.symptomKeywords,
        triageDescription: normalizeOptionalString(input.triageDescription),
        isTriageFallback: input.isTriageFallback,
        isActive: input.isActive,
      },
      select: departmentSelect,
    });

    if (department.isTriageFallback) {
      await prisma.department.updateMany({
        where: { id: { not: department.id }, isTriageFallback: true },
        data: { isTriageFallback: false },
      });
    }

    if (imageAsset || input.imageAssetId === null) {
      await MediaAssetService.detachOwnerAssets(
        "DEPARTMENT",
        id,
        imageAsset?.id,
      );
    }

    return department;
  }

  async delete(id: string) {
    const department = await this.getById(id);

    if (department._count.doctors > 0 || department._count.appointments > 0) {
      throw new AppError(
        "Không thể xóa chuyên khoa đã có bác sĩ hoặc lịch hẹn",
        409,
      );
    }

    await prisma.department.delete({
      where: { id },
    });

    return department;
  }
}

export default new DepartmentService();

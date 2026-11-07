import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  buildFeaturedSlotWhere,
  publicBookableDoctorWhere,
  publicCompletePackageWhere,
} from "./publicCatalogEligibility.js";
import PackageService from "./package.service.js";
import PublicDoctorService from "./publicDoctor.service.js";

const publicDepartmentSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  symptomKeywords: true,
  triageDescription: true,
} satisfies Prisma.DepartmentSelect;

type PublicDepartmentCatalogSort = "POPULAR_DESC" | "NAME_ASC";

class PublicDepartmentService {
  async list(query: { search?: string; limit?: number; featured?: boolean }) {
    const where: Prisma.DepartmentWhereInput = {
      isActive: true,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.featured) {
      const slotWhere = buildFeaturedSlotWhere();
      const doctorWhere = publicBookableDoctorWhere(slotWhere);
      const packageWhere: Prisma.PackageWhereInput = {
        isActive: true,
        ...publicCompletePackageWhere,
      };
      where.AND = [
        {
          OR: [
            { doctors: { some: doctorWhere } },
            { packages: { some: packageWhere } },
          ],
        },
      ];

      const departments = await prisma.department.findMany({
        where,
        select: {
          ...publicDepartmentSelect,
          _count: {
            select: {
              doctors: { where: doctorWhere },
              packages: { where: packageWhere },
            },
          },
        },
      });

      return departments
        .sort((left, right) => {
          const leftScore = left._count.doctors * 10 + left._count.packages;
          const rightScore = right._count.doctors * 10 + right._count.packages;
          return rightScore - leftScore || left.name.localeCompare(right.name, "vi");
        })
        .slice(0, query.limit)
        .map(({ _count, ...department }) => department);
    }

    return prisma.department.findMany({
      where,
      select: publicDepartmentSelect,
      orderBy: {
        name: "asc",
      },
      take: query.limit
        ? Math.min(Math.max(Math.trunc(query.limit), 1), 50)
        : undefined,
    });
  }

  async getBySlug(slug: string) {
    const department = await prisma.department.findFirst({
      where: {
        slug,
        isActive: true,
      },
      select: publicDepartmentSelect,
    });

    if (!department) {
      throw new AppError("Không tìm thấy chuyên khoa", 404);
    }

    return department;
  }

  async listCatalog(query: {
    search?: string;
    available?: boolean;
    sort?: PublicDepartmentCatalogSort;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Math.trunc(query.page || 1), 1);
    const limit = Math.min(Math.max(Math.trunc(query.limit || 8), 1), 24);
    const slotWhere = buildFeaturedSlotWhere();
    const doctorWhere = publicBookableDoctorWhere(slotWhere);
    const packageWhere: Prisma.PackageWhereInput = {
      isActive: true,
      ...publicCompletePackageWhere,
    };
    const where: Prisma.DepartmentWhereInput = {
      isActive: true,
      ...(query.available ? { doctors: { some: doctorWhere } } : {}),
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { triageDescription: { contains: search, mode: "insensitive" } },
        { symptomKeywords: { has: search } },
      ];
    }

    const [departments, publicDoctorCount, publicPackageCount, activeDepartmentCount, departmentsWithSlots] =
      await Promise.all([
        prisma.department.findMany({
          where,
          select: {
            ...publicDepartmentSelect,
            doctors: {
              where: doctorWhere,
              select: { id: true },
            },
            _count: {
              select: {
                doctors: { where: doctorWhere },
                packages: { where: packageWhere },
              },
            },
          },
        }),
        prisma.doctorProfile.count({ where: doctorWhere }),
        prisma.package.count({ where: packageWhere }),
        prisma.department.count({ where: { isActive: true } }),
        prisma.doctorProfile.findMany({
          where: doctorWhere,
          distinct: ["departmentId"],
          select: { departmentId: true },
        }),
      ]);

    const departmentIds = departments.map((department) => department.id);
    const doctorIds = departments.flatMap((department) =>
      department.doctors.map((doctor) => doctor.id),
    );
    const [reviews, availableSlots] = departmentIds.length
      ? await Promise.all([
          prisma.review.findMany({
            where: {
              isVisible: true,
              doctorId: { in: doctorIds },
            },
            select: {
              rating: true,
              doctor: { select: { departmentId: true } },
            },
          }),
          prisma.doctorTimeSlot.findMany({
            where: {
              ...slotWhere,
              doctor: { departmentId: { in: departmentIds } },
            },
            select: {
              doctor: { select: { departmentId: true } },
            },
          }),
        ])
      : [[], []];

    const reviewsByDepartment = new Map<
      string,
      { count: number; total: number }
    >();
    reviews.forEach((review) => {
      const departmentId = review.doctor.departmentId;
      const current = reviewsByDepartment.get(departmentId) || {
        count: 0,
        total: 0,
      };
      current.count += 1;
      current.total += review.rating;
      reviewsByDepartment.set(departmentId, current);
    });

    const slotsByDepartment = new Map<string, number>();
    availableSlots.forEach((slot) => {
      const departmentId = slot.doctor.departmentId;
      slotsByDepartment.set(
        departmentId,
        (slotsByDepartment.get(departmentId) || 0) + 1,
      );
    });

    const catalogItems = departments.map(({ doctors: _doctors, _count, ...department }) => {
      const review = reviewsByDepartment.get(department.id);
      const availableSlotCount = slotsByDepartment.get(department.id) || 0;

      return {
        ...department,
        doctorCount: _count.doctors,
        packageCount: _count.packages,
        availableSlotCount,
        reviewSummary: {
          count: review?.count || 0,
          averageRating: review?.count ? review.total / review.count : 0,
        },
      };
    });

    catalogItems.sort((left, right) => {
      if (query.sort === "NAME_ASC") {
        return left.name.localeCompare(right.name, "vi");
      }

      const leftScore =
        left.doctorCount * 10 +
        left.packageCount * 3 +
        Math.min(left.availableSlotCount, 10) +
        left.reviewSummary.averageRating;
      const rightScore =
        right.doctorCount * 10 +
        right.packageCount * 3 +
        Math.min(right.availableSlotCount, 10) +
        right.reviewSummary.averageRating;

      return rightScore - leftScore || left.name.localeCompare(right.name, "vi");
    });

    const total = catalogItems.length;
    const items = catalogItems.slice((page - 1) * limit, page * limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        departmentCount: activeDepartmentCount,
        doctorCount: publicDoctorCount,
        packageCount: publicPackageCount,
        departmentsWithSlots: departmentsWithSlots.length,
      },
    };
  }

  async getOverviewBySlug(slug: string) {
    const department = await this.getBySlug(slug);
    const slotWhere = buildFeaturedSlotWhere();
    const doctorWhere: Prisma.DoctorProfileWhereInput = {
      ...publicBookableDoctorWhere(slotWhere),
      departmentId: department.id,
    };

    const [doctors, packageCatalog, doctorCount, availableSlotCount, reviewAggregate] =
      await Promise.all([
        PublicDoctorService.list({
          departmentSlug: slug,
          includeHighlights: true,
          limit: 4,
        }),
        PackageService.publicCatalog({
          departmentId: department.id,
          page: 1,
          limit: 3,
        }),
        prisma.doctorProfile.count({ where: doctorWhere }),
        prisma.doctorTimeSlot.count({
          where: {
            ...slotWhere,
            doctor: { departmentId: department.id },
          },
        }),
        prisma.review.aggregate({
          where: {
            isVisible: true,
            doctor: { departmentId: department.id },
          },
          _count: { id: true },
          _avg: { rating: true },
        }),
      ]);

    return {
      department,
      doctors,
      packages: packageCatalog.items,
      summary: {
        doctorCount,
        packageCount: packageCatalog.pagination.total,
        availableSlotCount,
        reviewSummary: {
          count: reviewAggregate._count.id,
          averageRating: reviewAggregate._avg.rating || 0,
        },
      },
    };
  }
}

export default new PublicDepartmentService();

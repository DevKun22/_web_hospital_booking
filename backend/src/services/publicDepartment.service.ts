import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { createFoldedMatcher } from "../utils/textSearch.js";
import { TtlCache } from "../utils/ttlCache.js";
import { getPublicContentVersion } from "./publicContentVersion.js";
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
  sections: true,
  contentReviewerName: true,
  contentUpdatedAt: true,
  image: true,
  symptomKeywords: true,
  triageDescription: true,
} satisfies Prisma.DepartmentSelect;

type PublicDepartmentCatalogSort = "POPULAR_DESC" | "NAME_ASC";

type CatalogItem = {
  doctorCount: number;
  packageCount: number;
  availableSlotCount: number;
  reviewSummary: { averageRating: number };
};

// Điểm "thường đặt": bác sĩ nhận lịch nặng nhất, rồi số gói, giờ trống (tối đa 10) và điểm đánh giá.
const catalogScore = (item: CatalogItem) =>
  item.doctorCount * 10 +
  item.packageCount * 3 +
  Math.min(item.availableSlotCount, 10) +
  item.reviewSummary.averageRating;

// Phần nặng của danh mục: mọi khoa đang hoạt động kèm số bác sĩ nhận lịch, số gói, giờ trống và điểm đánh giá.
// Kết quả không phụ thuộc câu tìm hay trang nên đệm chung một bản (xem catalogCache).
const loadDepartmentCatalog = async () => {
  const slotWhere = buildFeaturedSlotWhere();
  const doctorWhere = publicBookableDoctorWhere(slotWhere);
  const packageWhere: Prisma.PackageWhereInput = {
    isActive: true,
    ...publicCompletePackageWhere,
  };

  const [departments, publicDoctorCount, publicPackageCount] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
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
  ]);

  // Đếm đánh giá và giờ trống ngay trong cơ sở dữ liệu (groupBy theo bác sĩ, tối đa một dòng mỗi bác sĩ) rồi gộp theo khoa.
  // Chỉ bác sĩ đang nhận lịch (`doctorWhere`) được tính, khớp với số bác sĩ và với việc giờ của bác sĩ tạm ngừng không đặt được.
  const departmentOfDoctor = new Map<string, string>();
  for (const department of departments) {
    for (const doctor of department.doctors) departmentOfDoctor.set(doctor.id, department.id);
  }
  const doctorIds = [...departmentOfDoctor.keys()];
  const [reviewGroups, slotGroups] = doctorIds.length
    ? await Promise.all([
        prisma.review.groupBy({
          by: ["doctorId"],
          where: { isVisible: true, doctorId: { in: doctorIds } },
          _count: { _all: true },
          _sum: { rating: true },
        }),
        prisma.doctorTimeSlot.groupBy({
          by: ["doctorId"],
          where: { ...slotWhere, doctorId: { in: doctorIds } },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const reviewsByDepartment = new Map<string, { count: number; total: number }>();
  for (const group of reviewGroups) {
    const departmentId = departmentOfDoctor.get(group.doctorId);
    if (!departmentId) continue;
    const current = reviewsByDepartment.get(departmentId) ?? { count: 0, total: 0 };
    current.count += group._count._all;
    current.total += group._sum.rating ?? 0;
    reviewsByDepartment.set(departmentId, current);
  }

  const slotsByDepartment = new Map<string, number>();
  for (const group of slotGroups) {
    const departmentId = departmentOfDoctor.get(group.doctorId);
    if (!departmentId) continue;
    slotsByDepartment.set(departmentId, (slotsByDepartment.get(departmentId) ?? 0) + group._count._all);
  }

  const items = departments.map(({ doctors: _doctors, _count, ...department }) => {
    const review = reviewsByDepartment.get(department.id);
    return {
      ...department,
      doctorCount: _count.doctors,
      packageCount: _count.packages,
      availableSlotCount: slotsByDepartment.get(department.id) || 0,
      reviewSummary: {
        count: review?.count || 0,
        averageRating: review?.count ? review.total / review.count : 0,
      },
    };
  });

  return {
    items,
    summary: {
      departmentCount: departments.length,
      doctorCount: publicDoctorCount,
      packageCount: publicPackageCount,
      departmentsWithSlots: items.filter((item) => item.doctorCount > 0).length,
    },
  };
};

// Danh mục đổi theo giờ trống nên chỉ đệm ngắn; quản trị sửa nội dung thì phiên bản đổi và bản đệm bị bỏ ngay.
const catalogCache = new TtlCache<Awaited<ReturnType<typeof loadDepartmentCatalog>>>(1, 30_000);

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
    const { items: allItems, summary } = await catalogCache.getOrLoad(
      "all",
      loadDepartmentCatalog,
      getPublicContentVersion(),
    );

    // Lọc, tìm không dấu, sắp xếp và cắt trang chạy trên bản đệm; chỉ phần tải và đếm mới chạm cơ sở dữ liệu.
    const matches = createFoldedMatcher(query.search);
    const catalogItems = allItems.filter(
      (department) =>
        (!query.available || department.doctorCount > 0) &&
        (!matches ||
          matches([
            department.name,
            department.slug,
            department.description,
            department.triageDescription,
            ...department.symptomKeywords,
          ])),
    );

    catalogItems.sort((left, right) => {
      if (query.sort === "NAME_ASC") {
        return left.name.localeCompare(right.name, "vi");
      }
      return (
        catalogScore(right) - catalogScore(left) ||
        left.name.localeCompare(right.name, "vi")
      );
    });

    const total = catalogItems.length;
    return {
      items: catalogItems.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
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

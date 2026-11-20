import { Prisma } from "../../generated/prisma/client.js";
import { databaseSchema, prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { getVietnamNowParts, parseDateOnly } from "../utils/time.js";
import { buildFeaturedSlotWhere, getFeaturedAvailabilityWindow } from "./publicCatalogEligibility.js";

const doctorTimeSlotTable = Prisma.raw(`"${databaseSchema}"."DoctorTimeSlot"`);

const publicDoctorSelect = {
  id: true,
  slug: true,
  title: true,
  bio: true,
  motto: true,
  careerTimeline: true,
  memberships: true,
  expertise: true,
  profileReviewerName: true,
  profileUpdatedAt: true,
  specialization: true,
  experience: true,
  consultationFee: true,
  isAvailable: true,
  updatedAt: true,
  user: {
    select: {
      fullName: true,
      avatar: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.DoctorProfileSelect;

type HighlightedDoctor<T> = T & {
  reviewSummary: {
    count: number;
    averageRating: number;
  };
  todayAvailableSlots: Array<{
    id: string;
    startTime: string;
    endTime: string;
  }>;
};

class PublicDoctorService {
  async list(query: {
    search?: string;
    departmentSlug?: string;
    departmentId?: string;
    includeHighlights?: boolean;
    limit?: number;
  }) {
    const where = this.buildWhere(query);

    if (query.includeHighlights) {
      return this.listFeatured(where, query.limit);
    }

    const doctors = await prisma.doctorProfile.findMany({
      where,
      select: publicDoctorSelect,
      orderBy: {
        user: {
          fullName: "asc",
        },
      },
      take: query.limit
        ? Math.min(Math.max(Math.trunc(query.limit), 1), 50)
        : undefined,
    });

    return doctors;
  }

  // Khung giờ trống sớm nhất của mỗi bác sĩ, xếp theo giờ sớm nhất. Dùng DISTINCT ON để cơ sở dữ liệu trả đúng một dòng mỗi bác
  // sĩ: `distinct` của Prisma chạy trong bộ nhớ nên bản cũ kéo về mọi khung giờ trống (hàng nghìn dòng) trên mỗi lần mở trang chủ.
  private async earliestSlotPerDoctor(doctorIds: string[], limit: number) {
    if (doctorIds.length === 0) return [];
    const { today, nowTime, tomorrow, endExclusive } = getFeaturedAvailabilityWindow();

    return prisma.$queryRaw<
      Array<{ id: string; doctorId: string; date: Date; startTime: string; endTime: string }>
    >(Prisma.sql`
      SELECT earliest."id", earliest."doctorId", earliest."date", earliest."startTime", earliest."endTime"
      FROM (
        SELECT DISTINCT ON (slot."doctorId") slot."id", slot."doctorId", slot."date", slot."startTime", slot."endTime"
        FROM ${doctorTimeSlotTable} AS slot
        WHERE slot."doctorId" IN (${Prisma.join(doctorIds)})
          AND slot."status" = 'AVAILABLE'
          AND slot."isActive" = true
          AND (
            (slot."date" = ${today} AND slot."startTime" > ${nowTime})
            OR (slot."date" >= ${tomorrow} AND slot."date" < ${endExclusive})
          )
        ORDER BY slot."doctorId", slot."date", slot."startTime"
      ) AS earliest
      ORDER BY earliest."date", earliest."startTime"
      LIMIT ${limit}
    `);
  }

  private async listFeatured(
    where: Prisma.DoctorProfileWhereInput,
    requestedLimit?: number,
  ) {
    const limit = Math.min(Math.max(Math.trunc(requestedLimit || 3), 1), 50);
    const candidateLimit = Math.min(limit * 5, 100);
    const doctorRows = await prisma.doctorProfile.findMany({ where, select: { id: true } });
    const earliestSlots = await this.earliestSlotPerDoctor(
      doctorRows.map((doctor) => doctor.id),
      candidateLimit,
    );
    const rankedDoctorIds = earliestSlots.map((slot) => slot.doctorId);
    const nextSlotByDoctorId = new Map(
      earliestSlots.map((slot) => [slot.doctorId, slot]),
    );

    const bookableDoctors = rankedDoctorIds.length
      ? await prisma.doctorProfile.findMany({
          where: {
            AND: [where, { id: { in: rankedDoctorIds } }],
          },
          select: publicDoctorSelect,
        })
      : [];

    const fallbackCount = Math.max(limit - bookableDoctors.length, 0);
    const fallbackDoctors = fallbackCount
      ? await prisma.doctorProfile.findMany({
          where: {
            AND: [
              where,
              ...(rankedDoctorIds.length
                ? [{ id: { notIn: rankedDoctorIds } }]
                : []),
            ],
          },
          select: publicDoctorSelect,
          orderBy: [
            { experience: { sort: "desc", nulls: "last" } },
            { user: { fullName: "asc" } },
          ],
          take: fallbackCount,
        })
      : [];

    const highlighted = await this.withHighlights([
      ...bookableDoctors,
      ...fallbackDoctors,
    ]);

    return highlighted
      .sort((left, right) => {
        const leftSlot = nextSlotByDoctorId.get(left.id);
        const rightSlot = nextSlotByDoctorId.get(right.id);
        if (leftSlot || rightSlot) {
          if (!leftSlot) return 1;
          if (!rightSlot) return -1;
          const slotComparison =
            leftSlot.date.getTime() - rightSlot.date.getTime() ||
            leftSlot.startTime.localeCompare(rightSlot.startTime);
          if (slotComparison) return slotComparison;
        }

        return (
          right.reviewSummary.averageRating - left.reviewSummary.averageRating ||
          right.reviewSummary.count - left.reviewSummary.count ||
          (right.experience || 0) - (left.experience || 0) ||
          left.user.fullName.localeCompare(right.user.fullName, "vi")
        );
      })
      .slice(0, limit)
      .map((doctor) => {
        const nextSlot = nextSlotByDoctorId.get(doctor.id);
        return {
          ...doctor,
          nextAvailableSlot: nextSlot
            ? {
                id: nextSlot.id,
                date: nextSlot.date,
                startTime: nextSlot.startTime,
                endTime: nextSlot.endTime,
              }
            : null,
        };
      });
  }

  async listCatalog(query: {
    search?: string;
    departmentId?: string;
    minExperience?: number;
    availableToday?: boolean;
    sort?: "NAME_ASC" | "EXPERIENCE_DESC";
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Math.trunc(query.page || 1), 1);
    const limit = Math.min(Math.max(Math.trunc(query.limit || 10), 1), 50);
    const baseWhere = this.buildWhere({
      search: query.search,
      departmentId: query.departmentId,
      minExperience: query.minExperience,
    });
    const where: Prisma.DoctorProfileWhereInput = query.availableToday
      ? {
          AND: [
            baseWhere,
            { timeSlots: { some: buildFeaturedSlotWhere(1) } },
          ],
        }
      : baseWhere;
    const orderBy: Prisma.DoctorProfileOrderByWithRelationInput[] =
      query.sort === "EXPERIENCE_DESC"
        ? [
            { experience: { sort: "desc", nulls: "last" } },
            { user: { fullName: "asc" } },
          ]
        : [{ user: { fullName: "asc" } }];
    const [doctors, total, publicReviewCount, doctorsWithTodaySlots] =
      await prisma.$transaction([
      prisma.doctorProfile.findMany({
        where,
        select: publicDoctorSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.doctorProfile.count({ where }),
      prisma.review.count({
        where: { isVisible: true, doctor: { is: baseWhere } },
      }),
      prisma.doctorProfile.count({
        where: {
          AND: [
            baseWhere,
            { timeSlots: { some: buildFeaturedSlotWhere(1) } },
          ],
        },
      }),
    ]);

    return {
      items: await this.withHighlights(doctors),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        publicReviewCount,
        doctorsWithTodaySlots,
      },
    };
  }

  private buildWhere(query: {
    search?: string;
    departmentSlug?: string;
    departmentId?: string;
    minExperience?: number;
  }) {
    const where: Prisma.DoctorProfileWhereInput = {
      isAvailable: true,
      user: {
        isActive: true,
      },
      department: {
        isActive: true,
        slug: query.departmentSlug,
        id: query.departmentId,
      },
      experience:
        query.minExperience && query.minExperience > 0
          ? { gte: Math.trunc(query.minExperience) }
          : undefined,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { specialization: { contains: query.search, mode: "insensitive" } },
        { user: { fullName: { contains: query.search, mode: "insensitive" } } },
        {
          department: { name: { contains: query.search, mode: "insensitive" } },
        },
      ];
    }

    return where;
  }

  private async withHighlights<
    T extends { id: string },
  >(doctors: T[]): Promise<Array<HighlightedDoctor<T>>> {
    if (doctors.length === 0) return [];

    const doctorIds = doctors.map((doctor) => doctor.id);
    const vietnamNow = getVietnamNowParts();
    const today = parseDateOnly(vietnamNow.date);
    const [reviewAggregates, availableSlots] = await Promise.all([
      prisma.review.groupBy({
        by: ["doctorId"],
        where: {
          doctorId: { in: doctorIds },
          isVisible: true,
        },
        _count: { id: true },
        _avg: { rating: true },
      }),
      prisma.doctorTimeSlot.findMany({
        where: {
          doctorId: { in: doctorIds },
          date: today,
          startTime: { gt: vietnamNow.time },
          status: "AVAILABLE",
          isActive: true,
        },
        select: {
          id: true,
          doctorId: true,
          startTime: true,
          endTime: true,
        },
        orderBy: [{ doctorId: "asc" }, { startTime: "asc" }],
      }),
    ]);

    const reviewsByDoctor = new Map(
      reviewAggregates.map((aggregate) => [aggregate.doctorId, aggregate]),
    );
    const slotsByDoctor = new Map<
      string,
      Array<{ id: string; startTime: string; endTime: string }>
    >();

    for (const slot of availableSlots) {
      const current = slotsByDoctor.get(slot.doctorId) || [];
      if (current.length < 3) {
        current.push({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
        slotsByDoctor.set(slot.doctorId, current);
      }
    }

    return doctors.map((doctor) => {
      const review = reviewsByDoctor.get(doctor.id);
      return {
        ...doctor,
        reviewSummary: {
          count: review?._count.id || 0,
          averageRating: review?._avg.rating || 0,
        },
        todayAvailableSlots: slotsByDoctor.get(doctor.id) || [],
      };
    });
  }

  async getByIdentifier(identifier: string) {
    const doctor = await prisma.doctorProfile.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        isAvailable: true,
        user: {
          isActive: true,
        },
        department: {
          isActive: true,
        },
      },
      select: publicDoctorSelect,
    });

    if (!doctor) {
      throw new AppError("Không tìm thấy bác sĩ", 404);
    }

    const [reviewAggregate, publicReviews, schedules] = await Promise.all([
      prisma.review.aggregate({
        where: { doctorId: doctor.id, isVisible: true },
        _count: { id: true },
        _avg: {
          rating: true,
          doctorRating: true,
          serviceRating: true,
          facilityRating: true,
        },
      }),
      prisma.review.findMany({
        where: { doctorId: doctor.id, isVisible: true, comment: { not: null } },
        select: {
          id: true,
          rating: true,
          doctorRating: true,
          serviceRating: true,
          facilityRating: true,
          comment: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      // Lịch khám theo tuần (ca mẫu đang dùng) kèm nơi khám, để người khám biết bác sĩ khám thứ mấy, buổi nào, ở đâu.
      prisma.doctorSchedule.findMany({
        where: { doctorId: doctor.id, isActive: true },
        select: { dayOfWeek: true, startTime: true, endTime: true, facility: { select: { id: true, name: true, address: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
    ]);

    return {
      ...doctor,
      reviewSummary: {
        count: reviewAggregate._count.id,
        averageRating: reviewAggregate._avg.rating || 0,
        averageDoctorRating: reviewAggregate._avg.doctorRating || 0,
        averageServiceRating: reviewAggregate._avg.serviceRating || 0,
        averageFacilityRating: reviewAggregate._avg.facilityRating || 0,
      },
      publicReviews,
      schedules,
    };
  }

  async getById(id: string) {
    return this.getByIdentifier(id);
  }
}

export default new PublicDoctorService();

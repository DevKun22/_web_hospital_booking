import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { getVietnamNowParts, parseDateOnly } from "../utils/time.js";

const publicDoctorSelect = {
  id: true,
  slug: true,
  title: true,
  bio: true,
  specialization: true,
  experience: true,
  consultationFee: true,
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

class PublicDoctorService {
  async list(query: {
    search?: string;
    departmentSlug?: string;
    departmentId?: string;
    includeHighlights?: boolean;
    limit?: number;
  }) {
    const where = this.buildWhere(query);

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

    return query.includeHighlights
      ? this.withHighlights(doctors)
      : doctors;
  }

  async listCatalog(query: {
    search?: string;
    departmentId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Math.trunc(query.page || 1), 1);
    const limit = Math.min(Math.max(Math.trunc(query.limit || 10), 1), 50);
    const where = this.buildWhere(query);
    const [doctors, total] = await prisma.$transaction([
      prisma.doctorProfile.findMany({
        where,
        select: publicDoctorSelect,
        orderBy: { user: { fullName: "asc" } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.doctorProfile.count({ where }),
    ]);

    return {
      items: await this.withHighlights(doctors),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private buildWhere(query: {
    search?: string;
    departmentSlug?: string;
    departmentId?: string;
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
  >(doctors: T[]) {
    if (doctors.length === 0) return doctors;

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
      if (current.length < 2) {
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

    const [reviewAggregate, publicReviews] = await Promise.all([
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
    };
  }

  async getById(id: string) {
    return this.getByIdentifier(id);
  }
}

export default new PublicDoctorService();

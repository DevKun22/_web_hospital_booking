import type { Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

type CreateReviewInput = {
  appointmentId: string;
  patientId: string;
  doctorRating: number;
  serviceRating: number;
  facilityRating: number;
  comment?: string | null;
};

type DashboardReviewFilters = {
  doctorId?: string;
  minRating?: number;
  page?: number;
  limit?: number;
};

type Actor = { userId: string; role: Role };

const reviewSelect = {
  id: true,
  rating: true,
  doctorRating: true,
  serviceRating: true,
  facilityRating: true,
  comment: true,
  isVisible: true,
  moderationNote: true,
  moderatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const reviewableAppointmentSelect = {
  id: true,
  status: true,
  doctorId: true,
  review: { select: reviewSelect },
} as const;

class ReviewService {
  // Chỉ chủ tài khoản đã đăng nhập mới đánh giá được lịch của mình
  // (kể cả lịch đặt cho người thân). Không tiết lộ lịch của người khác: trả 404.
  private async findOwnedAppointment(appointmentId: string, patientId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId },
      select: reviewableAppointmentSelect,
    });
    if (!appointment) throw new AppError("Không tìm thấy lịch hẹn", 404);
    return appointment;
  }

  async getForPatient(appointmentId: string, patientId: string) {
    return (await this.findOwnedAppointment(appointmentId, patientId)).review;
  }

  async create(input: CreateReviewInput) {
    const appointment = await this.findOwnedAppointment(
      input.appointmentId,
      input.patientId,
    );
    if (appointment.status !== "COMPLETED")
      throw new AppError(
        "Chỉ có thể đánh giá sau khi lịch khám đã hoàn tất",
        409,
      );
    if (appointment.review)
      throw new AppError("Lịch hẹn này đã được đánh giá", 409);

    const rating = Number(
      (
        (input.doctorRating + input.serviceRating + input.facilityRating) /
        3
      ).toFixed(2),
    );

    try {
      return await prisma.review.create({
        data: {
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          rating,
          doctorRating: input.doctorRating,
          serviceRating: input.serviceRating,
          facilityRating: input.facilityRating,
          comment: input.comment?.trim() || null,
        },
        select: reviewSelect,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new AppError("Lịch hẹn này đã được đánh giá", 409);
      throw error;
    }
  }

  async dashboardList(filters: DashboardReviewFilters, actor: Actor) {
    const page = Math.max(filters.page || 1, 1);
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    let doctorId = filters.doctorId;

    if (actor.role === "DOCTOR") {
      const profile = await prisma.doctorProfile.findUnique({
        where: { userId: actor.userId },
        select: { id: true },
      });
      if (!profile) throw new AppError("Không tìm thấy hồ sơ bác sĩ", 404);
      doctorId = profile.id;
    }

    const where = {
      ...(doctorId ? { doctorId } : {}),
      ...(filters.minRating ? { rating: { gte: filters.minRating } } : {}),
    };
    const [items, total, aggregate] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        select: {
          ...reviewSelect,
          appointment: {
            select: {
              bookingCode: true,
              patientName: true,
              appointmentDate: true,
              startTime: true,
            },
          },
          doctor: {
            select: {
              title: true,
              user: { select: { fullName: true } },
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where,
        _avg: {
          rating: true,
          doctorRating: true,
          serviceRating: true,
          facilityRating: true,
        },
      }),
    ]);

    const safeItems =
      actor.role === "DOCTOR"
        ? items.map(({ appointment, ...review }) => ({
            ...review,
            appointment: {
              appointmentDate: appointment.appointmentDate,
              startTime: appointment.startTime,
            },
          }))
        : items;

    return {
      items: safeItems,
      metrics: {
        total,
        averageRating: aggregate._avg.rating || 0,
        averageDoctorRating: aggregate._avg.doctorRating || 0,
        averageServiceRating: aggregate._avg.serviceRating || 0,
        averageFacilityRating: aggregate._avg.facilityRating || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async updateVisibility(
    id: string,
    input: { isVisible: boolean; moderationNote?: string | null },
  ) {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!review) throw new AppError("Không tìm thấy đánh giá", 404);

    return prisma.review.update({
      where: { id },
      data: {
        isVisible: input.isVisible,
        moderationNote: input.moderationNote?.trim() || null,
        moderatedAt: new Date(),
      },
      select: reviewSelect,
    });
  }
}

export default new ReviewService();

import { Prisma } from "../../generated/prisma/client.js";
import type { Role, ScheduleChangeRequestStatus, ScheduleChangeRequestType } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { hasTimeOverlap, parseDateOnly, validateTimeRange } from "../utils/time.js";

type Actor = { userId: string; role: Role };
type CreateInput = {
  type: ScheduleChangeRequestType;
  scheduleId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxPatients: number;
  isActive?: boolean;
  effectiveFrom: string;
  reason: string;
};

const requestSelect = {
  id: true,
  type: true,
  status: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  slotDuration: true,
  maxPatients: true,
  isActive: true,
  effectiveFrom: true,
  reason: true,
  reviewerNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  schedule: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true, isActive: true } },
  doctor: {
    select: {
      id: true,
      title: true,
      user: { select: { fullName: true, avatar: true } },
      department: { select: { id: true, name: true } },
    },
  },
  requestedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ScheduleChangeRequestSelect;

const ensureManager = (actor: Actor) => {
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    throw new AppError("Bạn không có quyền duyệt yêu cầu đổi lịch", 403);
  }
};

class ScheduleChangeRequestService {
  async list(query: { status?: ScheduleChangeRequestStatus; doctorId?: string; page?: number; limit?: number }, actor: Actor) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const where: Prisma.ScheduleChangeRequestWhereInput = { status: query.status, doctorId: query.doctorId };
    if (actor.role === "DOCTOR") where.requestedById = actor.userId;

    const [items, total] = await prisma.$transaction([
      prisma.scheduleChangeRequest.findMany({
        where,
        select: requestSelect,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.scheduleChangeRequest.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(input: CreateInput, actor: Actor) {
    if (actor.role !== "DOCTOR") throw new AppError("Chỉ bác sĩ mới có thể gửi yêu cầu đổi lịch", 403);
    validateTimeRange(input.startTime, input.endTime);
    if (input.maxPatients !== 1) throw new AppError("Mỗi slot hiện chỉ hỗ trợ một bệnh nhân", 400);

    const effectiveFrom = parseDateOnly(input.effectiveFrom);
    const today = parseDateOnly(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
    if (effectiveFrom < today) throw new AppError("Ngày áp dụng không được ở quá khứ", 400);

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (!doctor) throw new AppError("Tài khoản chưa được liên kết hồ sơ bác sĩ", 403);

    const needsSchedule = input.type !== "CREATE_WEEKLY_SCHEDULE";
    let scheduleId: string | null = null;
    if (needsSchedule) {
      const schedule = await prisma.doctorSchedule.findFirst({ where: { id: input.scheduleId || "", doctorId: doctor.id }, select: { id: true } });
      if (!schedule) throw new AppError("Không tìm thấy lịch mẫu thuộc bác sĩ", 404);
      scheduleId = schedule.id;
    }

    if (
      input.type !== "DEACTIVATE_WEEKLY_SCHEDULE" &&
      input.isActive !== false
    ) {
      await this.ensureNoOverlap({
        doctorId: doctor.id,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        excludeId: scheduleId || undefined,
      });
    }

    return prisma.scheduleChangeRequest.create({
      data: {
        doctorId: doctor.id,
        scheduleId,
        requestedById: actor.userId,
        type: input.type,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDuration: input.slotDuration,
        maxPatients: input.maxPatients,
        isActive: input.type === "DEACTIVATE_WEEKLY_SCHEDULE" ? false : (input.isActive ?? true),
        effectiveFrom,
        reason: input.reason.trim(),
      },
      select: requestSelect,
    });
  }

  async review(id: string, input: { status: "APPROVED" | "REJECTED"; reviewerNote?: string | null }, actor: Actor) {
    ensureManager(actor);
    const request = await prisma.scheduleChangeRequest.findUnique({ where: { id } });
    if (!request) throw new AppError("Không tìm thấy yêu cầu đổi lịch", 404);
    if (request.status !== "PENDING") throw new AppError("Yêu cầu này đã được xử lý", 409);

    if (input.status === "REJECTED") {
      return prisma.scheduleChangeRequest.update({
        where: { id },
        data: { status: "REJECTED", reviewerNote: input.reviewerNote?.trim() || null, reviewedById: actor.userId, reviewedAt: new Date() },
        select: requestSelect,
      });
    }

    const today = parseDateOnly(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
    if (request.effectiveFrom > today) {
      throw new AppError(
        "Chỉ duyệt yêu cầu vào hoặc sau ngày bắt đầu áp dụng để tránh thay đổi lịch mẫu quá sớm",
        409,
        "SCHEDULE_EFFECTIVE_DATE_NOT_REACHED",
      );
    }

    return prisma.$transaction(async (tx) => {
      let scheduleId = request.scheduleId;
      if (request.type === "CREATE_WEEKLY_SCHEDULE") {
        if (request.isActive) {
          await this.ensureNoOverlap({ doctorId: request.doctorId, dayOfWeek: request.dayOfWeek, startTime: request.startTime, endTime: request.endTime }, tx);
        }
        const schedule = await tx.doctorSchedule.create({
          data: { doctorId: request.doctorId, dayOfWeek: request.dayOfWeek, startTime: request.startTime, endTime: request.endTime, slotDuration: request.slotDuration, maxPatients: request.maxPatients, isActive: request.isActive },
          select: { id: true },
        });
        scheduleId = schedule.id;
      } else {
        const current = await tx.doctorSchedule.findFirst({ where: { id: request.scheduleId || "", doctorId: request.doctorId }, select: { id: true } });
        if (!current) throw new AppError("Lịch mẫu cần thay đổi không còn tồn tại", 404);
        if (request.type === "UPDATE_WEEKLY_SCHEDULE" && request.isActive) {
          await this.ensureNoOverlap({ doctorId: request.doctorId, dayOfWeek: request.dayOfWeek, startTime: request.startTime, endTime: request.endTime, excludeId: current.id }, tx);
        }
        await tx.doctorSchedule.update({
          where: { id: current.id },
          data: request.type === "DEACTIVATE_WEEKLY_SCHEDULE"
            ? { isActive: false }
            : { dayOfWeek: request.dayOfWeek, startTime: request.startTime, endTime: request.endTime, slotDuration: request.slotDuration, maxPatients: request.maxPatients, isActive: request.isActive },
        });
        scheduleId = current.id;
      }

      await tx.scheduleChangeLog.create({
        data: {
          doctorId: request.doctorId,
          changedById: actor.userId,
          type: "UPDATE_WEEKLY_SCHEDULE",
          date: request.effectiveFrom,
          startTime: request.startTime,
          endTime: request.endTime,
          note: `Duyệt yêu cầu ${request.type}: ${request.reason}`,
        },
      });

      return tx.scheduleChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", scheduleId, reviewerNote: input.reviewerNote?.trim() || null, reviewedById: actor.userId, reviewedAt: new Date() },
        select: requestSelect,
      });
    });
  }

  async cancel(id: string, actor: Actor) {
    if (actor.role !== "DOCTOR") throw new AppError("Chỉ bác sĩ mới có thể hủy yêu cầu", 403);
    const request = await prisma.scheduleChangeRequest.findFirst({ where: { id, requestedById: actor.userId }, select: { id: true, status: true } });
    if (!request) throw new AppError("Không tìm thấy yêu cầu đổi lịch", 404);
    if (request.status !== "PENDING") throw new AppError("Chỉ có thể hủy yêu cầu đang chờ duyệt", 409);
    return prisma.scheduleChangeRequest.update({ where: { id }, data: { status: "CANCELLED" }, select: requestSelect });
  }

  private async ensureNoOverlap(input: { doctorId: string; dayOfWeek: number; startTime: string; endTime: string; excludeId?: string }, client: Prisma.TransactionClient | typeof prisma = prisma) {
    const schedules = await client.doctorSchedule.findMany({
      where: { doctorId: input.doctorId, dayOfWeek: input.dayOfWeek, isActive: true, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
      select: { startTime: true, endTime: true },
    });
    if (schedules.some((schedule) => hasTimeOverlap(input.startTime, input.endTime, schedule.startTime, schedule.endTime))) {
      throw new AppError("Lịch đề xuất bị trùng với lịch mẫu hiện có", 409);
    }
  }
}

export default new ScheduleChangeRequestService();

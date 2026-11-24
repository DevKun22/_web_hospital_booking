import { Prisma } from "../../generated/prisma/client.js";
import AuditLogService from "./auditLog.service.js";
import type { TimeSlotStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  buildTimeSlots,
  getUtcDayOfWeek,
  isSlotStartInPastVietnamTime,
  parseDateOnly,
} from "../utils/time.js";
import type { Actor } from "../types/actor.js";
import { logger } from "../observability/logger.js";
import { MAX_AVAILABLE_DATE_RANGE_DAYS, summarizeAvailableDates } from "../utils/availableDates.js";


const doctorTimeSlotSelect = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  lockReason: true,
  createdAt: true,
  updatedAt: true,
  appointment: {
    select: {
      id: true,
      bookingCode: true,
      status: true,
    },
  },
  doctor: {
    select: {
      id: true,
      userId: true,
      title: true,
      specialization: true,
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
    },
  },
} satisfies Prisma.DoctorTimeSlotSelect;

// Lock/unlock only needs to confirm the new state. Avoid loading doctor and
// appointment relations again after the mutation.
const doctorTimeSlotMutationSelect = {
  id: true,
  doctorId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  lockReason: true,
  updatedAt: true,
} satisfies Prisma.DoctorTimeSlotSelect;

class DoctorTimeSlotService {
  async list(
    query: {
      doctorId?: string;
      date?: string;
      status?: TimeSlotStatus;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 30, 1), 200);
    const skip = (page - 1) * limit;

    const where: Prisma.DoctorTimeSlotWhereInput = {
      doctorId: query.doctorId,
      date: query.date ? parseDateOnly(query.date) : undefined,
      status: query.status,
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.doctorTimeSlot.findMany({
        where,
        select: doctorTimeSlotSelect,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        skip,
        take: limit,
      }),
      prisma.doctorTimeSlot.count({ where }),
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

  async getById(id: string, actor: Actor) {
    const where: Prisma.DoctorTimeSlotWhereInput = {
      id,
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const slot = await prisma.doctorTimeSlot.findFirst({
      where,
      select: doctorTimeSlotSelect,
    });

    if (!slot) {
      throw new AppError("Không tìm thấy slot", 404);
    }

    return slot;
  }

  async generate(input: { doctorId: string; date: string }) {
    const date = parseDateOnly(input.date);

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: {
        id: true,
        isAvailable: true,
        user: { select: { isActive: true } },
        department: { select: { isActive: true } },
      },
    });

    if (!doctor) {
      throw new AppError("Không tìm thấy bác sĩ", 404);
    }

    if (
      !doctor.isAvailable ||
      !doctor.user.isActive ||
      !doctor.department.isActive
    ) {
      throw new AppError("Bác sĩ không sẵn sàng nhận lịch", 409);
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId: input.doctorId,
        dayOfWeek: getUtcDayOfWeek(date),
        isActive: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    if (!schedules.length) {
      throw new AppError("Bác sĩ chưa có lịch làm việc trong ngày này", 404);
    }

    const slotData = schedules.flatMap((schedule) =>
      buildTimeSlots(
        schedule.startTime,
        schedule.endTime,
        schedule.slotDuration,
      ).map((slot) => ({
        doctorId: input.doctorId,
        scheduleId: schedule.id,
        facilityId: schedule.facilityId,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    );

    const created = await prisma.doctorTimeSlot.createMany({
      data: slotData,
      skipDuplicates: true,
    });

    const items = await prisma.doctorTimeSlot.findMany({
      where: {
        doctorId: input.doctorId,
        date,
      },
      select: doctorTimeSlotSelect,
      orderBy: {
        startTime: "asc",
      },
    });

    return {
      items,
      generatedCount: created.count,
      total: items.length,
    };
  }

  async updateStatus(
    id: string,
    status: TimeSlotStatus,
    lockReason?: string | null,
  ) {
    const slot = await this.getSlotForMutation(id);

    if (slot.status === "BOOKED" || slot.appointment) {
      throw new AppError("Không thể cập nhật slot đã được đặt", 409);
    }

    if (status === "BOOKED") {
      throw new AppError("Không thể đặt trạng thái BOOKED thủ công", 400);
    }

    return prisma.doctorTimeSlot.update({
      where: { id },
      data: {
        status,
        lockReason: status === "LOCKED" ? lockReason || slot.lockReason : null,
      },
      select: doctorTimeSlotSelect,
    });
  }

  async lock(id: string, lockReason: string, actor: Actor) {
    const startedAt = performance.now();
    const slot = await this.getSlotForMutation(id);
    const slotLookupMs = performance.now() - startedAt;
    this.assertDoctorCanManageSlot(slot, actor);

    if (slot.status === "BOOKED" || slot.appointment) {
      throw new AppError("Không thể khóa slot đã được đặt", 409);
    }

    const mutationStartedAt = performance.now();
    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.doctorTimeSlot.update({
        where: { id },
        data: { status: "LOCKED", lockReason },
        select: doctorTimeSlotMutationSelect,
      });
      await AuditLogService.record(
        {
          actor,
          action: "SCHEDULE_SLOT_LOCKED",
          targetType: "DOCTOR",
          targetId: slot.doctorId,
          meta: { slotId: id, date: slot.date.toISOString(), startTime: slot.startTime, endTime: slot.endTime, note: lockReason },
        },
        tx,
      );
      return locked;
    });
    const mutationMs = performance.now() - mutationStartedAt;
    logger.info(
      `[SLOT_LOCK] slot=${id} lookup=${slotLookupMs.toFixed(1)}ms mutation=${mutationMs.toFixed(1)}ms total=${(performance.now() - startedAt).toFixed(1)}ms`,
    );
    return updated;
  }

  async unlock(id: string, actor: Actor) {
    const slot = await this.getSlotForMutation(id);
    this.assertDoctorCanManageSlot(slot, actor);

    if (slot.status === "BOOKED" || slot.appointment) {
      throw new AppError("Không thể mở khóa slot đã được đặt", 409);
    }

    return prisma.$transaction(async (tx) => {
      const unlocked = await tx.doctorTimeSlot.update({
        where: { id },
        data: { status: "AVAILABLE", lockReason: null },
        select: doctorTimeSlotMutationSelect,
      });
      await AuditLogService.record(
        {
          actor,
          action: "SCHEDULE_SLOT_UNLOCKED",
          targetType: "DOCTOR",
          targetId: slot.doctorId,
          meta: { slotId: id, date: slot.date.toISOString(), startTime: slot.startTime, endTime: slot.endTime, note: "Mở khóa slot khám" },
        },
        tx,
      );
      return unlocked;
    });
  }
  async delete(id: string) {
    const slot = await this.getSlotForMutation(id);

    if (slot.status === "BOOKED" || slot.appointment) {
      throw new AppError("Không thể xóa slot đã được đặt", 409);
    }

    await prisma.doctorTimeSlot.delete({
      where: { id },
    });

    return slot;
  }

  async getPublicAvailableSlots(doctorId: string, dateString: string) {
    const date = parseDateOnly(dateString);

    const slots = await prisma.doctorTimeSlot.findMany({
      where: {
        doctorId,
        date,
        status: "AVAILABLE",
        doctor: {
          isAvailable: true,
          user: {
            isActive: true,
          },
          department: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        // Cơ sở của khung giờ (null: cơ sở mặc định) để người khám biết khám ở đâu.
        facility: { select: { id: true, name: true, address: true } },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return slots.filter(
      (slot) => !isSlotStartInPastVietnamTime(slot.date, slot.startTime),
    );
  }

  /** Các ngày còn khung giờ trống của bác sĩ trong khoảng [from, to], để lịch đặt khám đánh dấu ngày còn giờ. */
  async getPublicAvailableDates(doctorId: string, fromString: string, toString: string) {
    const from = parseDateOnly(fromString);
    const to = parseDateOnly(toString);
    if (to < from) throw new AppError("Khoảng ngày không hợp lệ", 400);
    if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_AVAILABLE_DATE_RANGE_DAYS) {
      throw new AppError(`Chỉ xem tối đa ${MAX_AVAILABLE_DATE_RANGE_DAYS} ngày một lần`, 400);
    }

    const slots = await prisma.doctorTimeSlot.findMany({
      where: {
        doctorId,
        date: { gte: from, lte: to },
        status: "AVAILABLE",
        doctor: { isAvailable: true, user: { isActive: true }, department: { isActive: true } },
      },
      select: { date: true, startTime: true },
    });

    return summarizeAvailableDates(slots);
  }

  private assertDoctorCanManageSlot(
    slot: { doctor: { userId: string }; date: Date; startTime: string },
    actor: Actor,
  ) {
    if (actor.role !== "DOCTOR") return;
    if (slot.doctor.userId !== actor.userId)
      throw new AppError("Bạn chỉ có thể thao tác slot của chính mình", 403);
    if (isSlotStartInPastVietnamTime(slot.date, slot.startTime)) {
      throw new AppError("Chỉ có thể thao tác slot chưa qua giờ khám", 409);
    }
  }

  private async getSlotForMutation(id: string) {
    const slot = await prisma.doctorTimeSlot.findUnique({
      where: { id },
      select: {
        id: true,
        doctorId: true,
        status: true,
        lockReason: true,
        date: true,
        startTime: true,
        endTime: true,
        doctor: { select: { userId: true } },
        appointment: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!slot) {
      throw new AppError("Không tìm thấy slot", 404);
    }

    return slot;
  }
}

export default new DoctorTimeSlotService();

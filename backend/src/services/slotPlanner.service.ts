import { randomUUID } from "node:crypto";
import type { Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  buildTimeSlots,
  getUtcDayOfWeek,
  getVietnamNowParts,
  isSlotStartInPastVietnamTime,
  parseDateOnly,
  toDateOnly,
} from "../utils/time.js";
import StaffNotificationService from "./staffNotification.service.js";

// Số ngày tới được tự sinh khung giờ từ lịch mẫu theo tuần.
export const ROLLING_WINDOW_DAYS = 14;
// Giới hạn một lần sinh hoặc đóng/mở theo khoảng ngày.
export const MAX_RANGE_DAYS = 62;
const ROLLING_THROTTLE_MS = 30 * 60 * 1000;

type Actor = { userId: string; role: Role };

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const vietnamToday = () => parseDateOnly(getVietnamNowParts().date);
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd;

export type AffectedAppointment = {
  appointmentId: string;
  bookingCode: string;
  patientName: string;
  date: string;
  startTime: string;
};

class SlotPlannerService {
  private lastRollingRunAt = 0;

  private assertRange(from: Date, to: Date) {
    if (to < from) {
      throw new AppError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu", 400, "INVALID_DATE_RANGE");
    }
    const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
    if (days > MAX_RANGE_DAYS) {
      throw new AppError(`Chỉ thao tác tối đa ${MAX_RANGE_DAYS} ngày một lần`, 400, "DATE_RANGE_TOO_LONG");
    }
    return days;
  }

  private async doctorReady(doctorId: string) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: {
        isAvailable: true,
        user: { select: { isActive: true, fullName: true } },
        department: { select: { isActive: true } },
      },
    });
    if (!doctor) throw new AppError("Không tìm thấy bác sĩ", 404);
    return {
      ready: doctor.isAvailable && doctor.user.isActive && doctor.department.isActive,
      name: doctor.user.fullName,
    };
  }

  /**
   * Sinh khung giờ cho một bác sĩ trong khoảng ngày từ các ca mẫu đang bật. Không sinh cho ngày đã qua,
   * không sinh khung giờ đã qua giờ trong hôm nay, không đè lên khung giờ hiện có (kể cả khung giờ
   * còn giữ lại vì đã có người đặt).
   */
  async generateRange(doctorId: string, fromInput: Date, toInput: Date) {
    const today = vietnamToday();
    const from = fromInput < today ? today : fromInput;
    if (toInput < from) return { generatedCount: 0, days: 0 };
    const days = this.assertRange(from, toInput);

    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId, isActive: true },
      orderBy: { startTime: "asc" },
    });
    if (!schedules.length) return { generatedCount: 0, days };

    const existing = await prisma.doctorTimeSlot.findMany({
      where: { doctorId, date: { gte: from, lte: toInput } },
      select: { date: true, startTime: true, endTime: true },
    });
    const existingByDate = new Map<string, { startTime: string; endTime: string }[]>();
    for (const slot of existing) {
      const key = toDateOnly(slot.date);
      existingByDate.set(key, [...(existingByDate.get(key) ?? []), slot]);
    }

    const data: {
      doctorId: string;
      scheduleId: string;
      date: Date;
      startTime: string;
      endTime: string;
    }[] = [];
    for (let index = 0; index < days; index += 1) {
      const date = addDays(from, index);
      const taken = existingByDate.get(toDateOnly(date)) ?? [];
      for (const schedule of schedules.filter((item) => item.dayOfWeek === getUtcDayOfWeek(date))) {
        for (const slot of buildTimeSlots(schedule.startTime, schedule.endTime, schedule.slotDuration)) {
          if (isSlotStartInPastVietnamTime(date, slot.startTime)) continue;
          // Trùng đúng giờ thì để skipDuplicates xử lý; lệch giờ mà chồng lấn mới cần bỏ qua.
          const clash = taken.some(
            (item) =>
              item.startTime !== slot.startTime &&
              overlaps(slot.startTime, slot.endTime, item.startTime, item.endTime),
          );
          if (clash) continue;
          data.push({ doctorId, scheduleId: schedule.id, date, startTime: slot.startTime, endTime: slot.endTime });
        }
      }
    }
    if (!data.length) return { generatedCount: 0, days };
    const created = await prisma.doctorTimeSlot.createMany({ data, skipDuplicates: true });
    return { generatedCount: created.count, days };
  }

  /** Giữ cửa sổ khung giờ luôn đầy cho mọi bác sĩ đang nhận lịch; chạy định kỳ, an toàn khi gọi lặp. */
  async generateRollingWindow(options: { force?: boolean } = {}) {
    const now = Date.now();
    if (!options.force && now - this.lastRollingRunAt < ROLLING_THROTTLE_MS) {
      return { skipped: true, doctors: 0, generatedCount: 0 };
    }
    this.lastRollingRunAt = now;
    const doctors = await prisma.doctorProfile.findMany({
      where: {
        isAvailable: true,
        user: { isActive: true },
        department: { isActive: true },
        schedules: { some: { isActive: true } },
      },
      select: { id: true },
    });
    const today = vietnamToday();
    let generatedCount = 0;
    for (const doctor of doctors) {
      try {
        const result = await this.generateRange(doctor.id, today, addDays(today, ROLLING_WINDOW_DAYS - 1));
        generatedCount += result.generatedCount;
      } catch (error) {
        console.error(`[SLOT_PLANNER] doctor=${doctor.id} failed:`, error);
      }
    }
    return { skipped: false, doctors: doctors.length, generatedCount };
  }

  /** Sinh cho khoảng ngày do người dùng chọn (nút "Sinh khung giờ"). */
  async generateForRange(input: { doctorId: string; from: string; to: string }) {
    const from = parseDateOnly(input.from);
    const to = parseDateOnly(input.to);
    this.assertRange(from, to);
    const doctor = await this.doctorReady(input.doctorId);
    if (!doctor.ready) throw new AppError("Bác sĩ không sẵn sàng nhận lịch", 409);
    const schedules = await prisma.doctorSchedule.count({ where: { doctorId: input.doctorId, isActive: true } });
    if (!schedules) throw new AppError("Bác sĩ chưa có lịch làm việc theo tuần", 404);
    return this.generateRange(input.doctorId, from, to);
  }

  private async futureSlotsOfSchedule(scheduleId: string) {
    return prisma.doctorTimeSlot.findMany({
      where: { scheduleId, date: { gte: vietnamToday() } },
      select: {
        id: true,
        status: true,
        date: true,
        startTime: true,
        appointment: { select: { id: true, bookingCode: true, patientName: true } },
      },
    });
  }

  /**
   * Gỡ các khung giờ tương lai còn trống thuộc ca mẫu (để người khám không đặt được giờ đã bỏ) và trả về
   * các lịch đã đặt đang nằm trong ca này. Lịch đã đặt KHÔNG bị hủy: nhân viên liên hệ người khám để đổi.
   */
  async releaseSchedule(scheduleId: string): Promise<{ removedSlots: number; affected: AffectedAppointment[] }> {
    const slots = await this.futureSlotsOfSchedule(scheduleId);
    const removable = slots.filter((slot) => slot.status !== "BOOKED" && !slot.appointment).map((slot) => slot.id);
    const affected = slots
      .filter((slot) => slot.appointment)
      .map((slot) => ({
        appointmentId: slot.appointment!.id,
        bookingCode: slot.appointment!.bookingCode,
        patientName: slot.appointment!.patientName,
        date: toDateOnly(slot.date),
        startTime: slot.startTime,
      }))
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    if (removable.length) {
      await prisma.doctorTimeSlot.deleteMany({ where: { id: { in: removable } } });
    }
    return { removedSlots: removable.length, affected };
  }

  /** Báo nhân viên, quản trị (và bác sĩ nếu người thao tác không phải bác sĩ) khi có lịch đã đặt bị ảnh hưởng. */
  async notifyAffected(
    doctorId: string,
    affected: AffectedAppointment[],
    cause: string,
    actor?: Actor | null,
  ) {
    if (!affected.length) return;
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { userId: true, user: { select: { fullName: true } } },
    });
    const key = randomUUID();
    const input = {
      type: "APPOINTMENT_RESCHEDULED" as const,
      title: "Có lịch hẹn cần xử lý do đổi lịch làm việc",
      body: `${doctor?.user.fullName ?? "Bác sĩ"}: ${affected.length} lịch đã đặt bị ảnh hưởng (${cause}). Liên hệ người khám để đổi lịch, ví dụ ${affected[0].bookingCode} ngày ${affected[0].date} lúc ${affected[0].startTime}.`,
      entityType: "APPOINTMENT",
      entityId: affected[0].appointmentId,
      excludeUserId: actor?.userId,
    };
    await StaffNotificationService.notifyRoles(["STAFF", "ADMIN"], { ...input, eventKey: `slot-impact:${key}:staff` });
    if (doctor && actor?.role !== "DOCTOR") {
      await StaffNotificationService.notifyUsers([doctor.userId], { ...input, eventKey: `slot-impact:${key}:doctor` });
    }
  }

  /** Sau khi tạo/sửa ca mẫu: sinh lại cửa sổ khung giờ cho bác sĩ đó. */
  async refreshDoctor(doctorId: string) {
    const today = vietnamToday();
    return this.generateRange(doctorId, today, addDays(today, ROLLING_WINDOW_DAYS - 1));
  }

  private assertDoctorScope(doctorUserId: string, actor: Actor) {
    if (actor.role === "DOCTOR" && doctorUserId !== actor.userId) {
      throw new AppError("Bạn chỉ có thể thao tác lịch của chính mình", 403);
    }
  }

  /** Bác sĩ nghỉ (phép, họp, việc đột xuất) trong một khoảng ngày: khóa các khung giờ còn trống, báo lịch đã đặt. */
  async closeRange(
    input: { doctorId: string; from: string; to: string; reason: string },
    actor: Actor,
  ) {
    const today = vietnamToday();
    const from = parseDateOnly(input.from);
    const to = parseDateOnly(input.to);
    if (from < today) throw new AppError("Chỉ đóng lịch từ hôm nay trở đi", 409, "RANGE_IN_PAST");
    this.assertRange(from, to);
    const reason = input.reason.trim();
    if (!reason) throw new AppError("Vui lòng nhập lý do nghỉ", 400);

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: { id: true, userId: true },
    });
    if (!doctor) throw new AppError("Không tìm thấy bác sĩ", 404);
    this.assertDoctorScope(doctor.userId, actor);

    // Sinh trước để các ngày chưa có khung giờ cũng được khóa, tránh tự mở lại khi sinh sau này.
    await this.generateRange(input.doctorId, from, to);

    const locked = await prisma.doctorTimeSlot.updateMany({
      where: {
        doctorId: input.doctorId,
        date: { gte: from, lte: to },
        status: "AVAILABLE",
        appointment: { is: null },
      },
      data: { status: "LOCKED", lockReason: reason },
    });
    const booked = await prisma.doctorTimeSlot.findMany({
      where: { doctorId: input.doctorId, date: { gte: from, lte: to }, appointment: { isNot: null } },
      select: {
        date: true,
        startTime: true,
        appointment: { select: { id: true, bookingCode: true, patientName: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const affected: AffectedAppointment[] = booked.map((slot) => ({
      appointmentId: slot.appointment!.id,
      bookingCode: slot.appointment!.bookingCode,
      patientName: slot.appointment!.patientName,
      date: toDateOnly(slot.date),
      startTime: slot.startTime,
    }));
    await prisma.scheduleChangeLog.create({
      data: {
        doctorId: input.doctorId,
        changedById: actor.userId,
        type: "LOCK_SLOT",
        note: `Nghỉ ${input.from} đến ${input.to}: ${reason}`,
        date: from,
      },
    });
    await this.notifyAffected(input.doctorId, affected, `nghỉ ${input.from} đến ${input.to}`, actor);
    return { lockedSlots: locked.count, affected };
  }

  /** Mở lại các khung giờ đã khóa trong khoảng ngày (không đụng khung giờ đã có lịch). */
  async reopenRange(input: { doctorId: string; from: string; to: string }, actor: Actor) {
    const today = vietnamToday();
    const from = parseDateOnly(input.from);
    const to = parseDateOnly(input.to);
    if (to < today) throw new AppError("Khoảng ngày đã qua", 409, "RANGE_IN_PAST");
    this.assertRange(from, to);
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: { userId: true },
    });
    if (!doctor) throw new AppError("Không tìm thấy bác sĩ", 404);
    this.assertDoctorScope(doctor.userId, actor);

    const reopened = await prisma.doctorTimeSlot.updateMany({
      where: {
        doctorId: input.doctorId,
        date: { gte: from < today ? today : from, lte: to },
        status: "LOCKED",
        appointment: { is: null },
      },
      data: { status: "AVAILABLE", lockReason: null },
    });
    await prisma.scheduleChangeLog.create({
      data: {
        doctorId: input.doctorId,
        changedById: actor.userId,
        type: "UNLOCK_SLOT",
        note: `Mở lại ${input.from} đến ${input.to}`,
        date: from,
      },
    });
    return { reopenedSlots: reopened.count };
  }
}

export default new SlotPlannerService();

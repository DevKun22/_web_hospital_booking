import PolicyService from "../policy.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { AppointmentLogAction, AppointmentStatus } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { getBookingHoldMinutes } from "../../config/environment.js";
import { AppError } from "../../utils/appError.js";
import { generateBookingCode } from "../../utils/bookingCode.js";
import NotificationService from "../notification.service.js";
import { appointmentSelect, type Actor } from "./appointment.shared.js";
export class AppointmentServiceSupport {
  protected async releasePendingAppointment(appointmentId: string) {
    await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { timeSlotId: true },
      });

      if (!appointment) return;

      await tx.appointment.delete({ where: { id: appointmentId } });
      if (appointment.timeSlotId) {
        await tx.doctorTimeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { status: "AVAILABLE", isActive: true, lockReason: null },
        });
      }
    });
  }

  protected async releaseAppointmentSlot(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    knownTimeSlotId?: string | null,
  ) {
    const timeSlotId =
      knownTimeSlotId === undefined
        ? (
            await tx.appointment.findUniqueOrThrow({
              where: { id: appointmentId },
              select: { timeSlotId: true },
            })
          ).timeSlotId
        : knownTimeSlotId;

    if (!timeSlotId) return;

    const detached = await tx.appointment.updateMany({
      where: { id: appointmentId, timeSlotId },
      data: { timeSlotId: null },
    });
    if (detached.count !== 1) {
      throw new AppError(
        "Liên kết khung giờ đã thay đổi",
        409,
        "APPOINTMENT_SLOT_CONFLICT",
      );
    }

    await tx.doctorTimeSlot.update({
      where: { id: timeSlotId },
      data: { status: "AVAILABLE", isActive: true, lockReason: null },
    });
  }

  protected getActorScopedAppointmentWhere(id: string, actor?: Actor) {
    const where: Prisma.AppointmentWhereInput = { id };

    if (actor?.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    return where;
  }

  protected isPendingOtpHoldExpired(appointment: {
    holdExpiresAt: Date | null;
    createdAt: Date;
  }) {
    const deadline =
      appointment.holdExpiresAt ||
      new Date(
        appointment.createdAt.getTime() + getBookingHoldMinutes() * 60 * 1000,
      );
    return deadline.getTime() <= Date.now();
  }

  protected async claimAppointmentTransition(
    tx: Prisma.TransactionClient,
    input: {
      id: string;
      actor?: Actor;
      expectedStatuses: AppointmentStatus[];
      nextStatus: AppointmentStatus;
      data?: Prisma.AppointmentUpdateManyMutationInput;
    },
  ) {
    const where = this.getActorScopedAppointmentWhere(input.id, input.actor);
    const claimed = await tx.appointment.updateMany({
      where: {
        ...where,
        status: { in: input.expectedStatuses },
      },
      data: {
        ...(input.data || {}),
        status: input.nextStatus,
      },
    });

    if (claimed.count === 1) {
      return;
    }

    const appointment = await tx.appointment.findFirst({
      where,
      select: {
        id: true,
        status: true,
      },
    });

    if (!appointment) {
      throw new AppError("Không tìm thấy lịch hẹn", 404);
    }

    throw new AppError(
      "Trạng thái lịch hẹn đã thay đổi, vui lòng tải lại dữ liệu",
      409,
      "APPOINTMENT_STATE_CONFLICT",
    );
  }

  protected async createTransitionLog(
    tx: Prisma.TransactionClient,
    input: {
      appointmentId: string;
      action: AppointmentLogAction;
      actor?: Actor;
      note?: string;
    },
  ) {
    await tx.appointmentLog.create({
      data: {
        appointmentId: input.appointmentId,
        action: input.action,
        createdById: input.actor?.userId,
        note: input.note,
      },
    });
  }

  protected async createAppointmentConfirmationNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_CONFIRMED",
        title: "Lịch khám đã được xác nhận",
        body: `Lịch ${appointment.bookingCode} ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime} đã được bệnh viện xác nhận.`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: "CONFIRMED",
        },
        dedupeKey: `appointment:${appointment.id}:confirmed`,
      },
      tx,
    );
  }

  protected async createAppointmentCancellationNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    reason?: string,
  ) {
    await this.cancelAppointmentReminders(tx, appointmentId);
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );
    const normalizedReason = reason?.trim();

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_CANCELLED",
        title: "Lịch khám đã được hủy",
        body: `Lịch ${appointment.bookingCode} ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime} đã được hủy${normalizedReason ? `: ${normalizedReason}` : "."}`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: appointment.status,
        },
        dedupeKey: `appointment:${appointment.id}:cancelled`,
      },
      tx,
    );
  }

  protected async createAppointmentReminderNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );
    const appointmentStart = this.getAppointmentStartAt(
      appointment.appointmentDate,
      appointment.startTime,
    );
    const now = new Date();
    if (appointmentStart <= now) return null;

    const scheduledAt = new Date(
      Math.max(
        now.getTime(),
        appointmentStart.getTime() -
          (await PolicyService.get()).reminderLeadMinutes * 60_000,
      ),
    );
    const dateKey = appointment.appointmentDate.toISOString().slice(0, 10);

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_REMINDER",
        title: "Sắp đến giờ khám",
        body: `Lịch ${appointment.bookingCode} sẽ diễn ra ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime}. Vui lòng đến sớm để làm thủ tục.`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: appointment.status,
        },
        dedupeKey: `appointment:${appointment.id}:reminder:${dateKey}:${appointment.startTime}`,
        scheduledAt,
        expiresAt: appointmentStart,
      },
      tx,
    );
  }

  protected async createAppointmentNoShowNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: "APPOINTMENT_NO_SHOW",
        title: "Lịch khám được ghi nhận không đến",
        body: `Lịch ${appointment.bookingCode} ngày ${this.formatNotificationDate(appointment.appointmentDate)} lúc ${appointment.startTime} đã được ghi nhận là không đến. Bạn có thể đặt lịch mới trên ứng dụng.`,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status: "NO_SHOW",
        },
        dedupeKey: `appointment:${appointment.id}:no-show`,
      },
      tx,
    );
  }

  protected async createAppointmentProgressNotification(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    status: "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED",
  ) {
    const appointment = await this.getAppointmentNotificationContext(
      tx,
      appointmentId,
    );
    const content = {
      CHECKED_IN: {
        type: "APPOINTMENT_CHECKED_IN" as const,
        title: "Bạn đã check-in",
        body: `Lịch ${appointment.bookingCode} đã được bệnh viện tiếp nhận. Vui lòng chờ đến lượt khám.`,
        dedupeSuffix: "checked-in",
      },
      IN_PROGRESS: {
        type: "APPOINTMENT_IN_PROGRESS" as const,
        title: "Bác sĩ đang tiếp nhận khám",
        body: `Lịch ${appointment.bookingCode} đã bắt đầu khám. Thông tin chuyên môn sẽ được cập nhật sau khi phát hành.`,
        dedupeSuffix: "in-progress",
      },
      COMPLETED: {
        type: "APPOINTMENT_COMPLETED" as const,
        title: "Buổi khám đã hoàn thành",
        body: `Lịch ${appointment.bookingCode} đã hoàn thành. Bạn có thể theo dõi kết quả, đơn thuốc và hóa đơn trên ứng dụng khi được phát hành.`,
        dedupeSuffix: "completed",
      },
    }[status];

    return NotificationService.create(
      {
        userId: appointment.patientId,
        type: content.type,
        title: content.title,
        body: content.body,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        payload: {
          bookingCode: appointment.bookingCode,
          status,
        },
        dedupeKey: `appointment:${appointment.id}:${content.dedupeSuffix}`,
      },
      tx,
    );
  }

  protected cancelAppointmentReminders(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    return tx.notification.updateMany({
      where: {
        dedupeKey: { startsWith: `appointment:${appointmentId}:reminder:` },
        cancelledAt: null,
      },
      data: { cancelledAt: new Date() },
    });
  }

  protected getAppointmentStartAt(date: Date, startTime: string) {
    const dateOnly = date.toISOString().slice(0, 10);
    return new Date(`${dateOnly}T${startTime}:00+07:00`);
  }

  protected getAppointmentEndAt(date: Date, endTime: string) {
    const dateOnly = date.toISOString().slice(0, 10);
    return new Date(`${dateOnly}T${endTime}:00+07:00`);
  }

  protected getAppointmentNotificationContext(
    tx: Prisma.TransactionClient,
    appointmentId: string,
  ) {
    return tx.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        bookingCode: true,
        appointmentDate: true,
        startTime: true,
        status: true,
      },
    });
  }

  protected formatNotificationDate(date: Date) {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }


  protected getTransitionResult(tx: Prisma.TransactionClient, id: string) {
    return tx.appointment.findUniqueOrThrow({
      where: { id },
      select: appointmentSelect,
    });
  }

  protected async generateUniqueBookingCode(tx: Prisma.TransactionClient) {
    for (let index = 0; index < 10; index += 1) {
      const bookingCode = generateBookingCode();
      const existing = await tx.appointment.findUnique({
        where: { bookingCode },
        select: { id: true },
      });

      if (!existing) {
        return bookingCode;
      }
    }

    throw new AppError("Không thể tạo mã đặt lịch", 500);
  }
}

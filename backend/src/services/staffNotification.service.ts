import { randomUUID } from "node:crypto";
import type { Role } from "../../generated/prisma/enums.js";
import type { NotificationType } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";

type StaffEventInput = {
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  // Phần định danh sự kiện, dùng cho khóa chống trùng (mỗi người nhận một bản ghi).
  eventKey: string;
  excludeUserId?: string | null;
};

const dateText = (value: Date) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" }).format(value);

/**
 * Thông báo nội bộ cho nhân sự. Chỉ tạo bản ghi hộp thư (không đẩy ra thiết bị),
 * luôn "best effort": lỗi ở đây không được làm hỏng nghiệp vụ chính.
 */
class StaffNotificationService {
  private async deliver(userIds: string[], input: StaffEventInput) {
    const recipients = [...new Set(userIds)].filter(
      (id) => id && id !== input.excludeUserId,
    );
    if (recipients.length === 0) return 0;
    const now = new Date();
    const result = await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        id: randomUUID(),
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
        scheduledAt: now,
        publishedAt: now,
        dedupeKey: `staff:${input.eventKey}:${userId}`,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async notifyUsers(userIds: string[], input: StaffEventInput) {
    try {
      return await this.deliver(userIds, input);
    } catch (error) {
      console.error("[STAFF_NOTIFICATION] notifyUsers failed:", error);
      return 0;
    }
  }

  async notifyRoles(roles: Role[], input: StaffEventInput) {
    try {
      const users = await prisma.user.findMany({
        where: { role: { in: roles }, isActive: true },
        select: { id: true },
      });
      return await this.deliver(
        users.map((user) => user.id),
        input,
      );
    } catch (error) {
      console.error("[STAFF_NOTIFICATION] notifyRoles failed:", error);
      return 0;
    }
  }

  /** Lịch hẹn thay đổi: báo bác sĩ phụ trách, và (nếu cần) lễ tân. */
  async notifyAppointmentEvent(
    appointmentId: string,
    event: "CREATED" | "CONFIRMED" | "CANCELLED" | "RESCHEDULED" | "CHECKED_IN",
    options: { actorId?: string | null; includeReception?: boolean; includeDoctor?: boolean } = {},
  ) {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          bookingCode: true,
          patientName: true,
          appointmentDate: true,
          startTime: true,
          doctor: { select: { userId: true } },
        },
      });
      if (!appointment) return;

      const when = `${dateText(appointment.appointmentDate)} lúc ${appointment.startTime}`;
      const label = `${appointment.bookingCode} (${appointment.patientName})`;
      const content: Record<typeof event, { type: NotificationType; title: string; body: string }> = {
        CREATED: {
          type: "APPOINTMENT_CREATED",
          title: "Có lịch hẹn mới",
          body: `Lịch ${label} vừa được đặt cho ${when}, đang chờ xác nhận.`,
        },
        CONFIRMED: {
          type: "APPOINTMENT_CONFIRMED",
          title: "Lịch hẹn đã được xác nhận",
          body: `Lịch ${label} đã được xác nhận cho ${when}.`,
        },
        CANCELLED: {
          type: "APPOINTMENT_CANCELLED",
          title: "Lịch hẹn đã bị hủy",
          body: `Lịch ${label} dự kiến ${when} đã bị hủy.`,
        },
        RESCHEDULED: {
          type: "APPOINTMENT_RESCHEDULED",
          title: "Lịch hẹn đã được đổi",
          body: `Lịch ${label} được đổi sang ${when}.`,
        },
        CHECKED_IN: {
          type: "APPOINTMENT_CHECKED_IN",
          title: "Người khám đã đến",
          body: `Người khám ${label} đã check-in, sẵn sàng cho buổi khám lúc ${appointment.startTime}.`,
        },
      };
      const base = {
        ...content[event],
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        excludeUserId: options.actorId,
      };

      if (options.includeDoctor !== false && appointment.doctor?.userId) {
        await this.notifyUsers([appointment.doctor?.userId], {
          ...base,
          eventKey: `appointment:${appointment.id}:${event}:doctor`,
        });
      }
      if (options.includeReception) {
        await this.notifyRoles(["STAFF"], {
          ...base,
          eventKey: `appointment:${appointment.id}:${event}:reception`,
        });
      }
    } catch (error) {
      console.error("[STAFF_NOTIFICATION] appointment event failed:", error);
    }
  }
}

export default new StaffNotificationService();

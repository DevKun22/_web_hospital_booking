import type { Prisma } from "../../generated/prisma/client.js";
import type { prisma } from "../config/prisma.js";

// Nhật ký lịch hẹn nằm trong AuditLog (targetType = APPOINTMENT, targetId = id lịch hẹn): ai làm gì và lúc nào, không ghi
// nội dung y tế. Dùng chung một bảng chỉ-thêm-dòng với nhật ký truy cập nên không mất khi dữ liệu gốc bị xóa.
// Tên hành động chung chung (CONFIRMED, COMPLETED...) được thêm tiền tố APPOINTMENT_ khi lưu để không lẫn với nhật ký khác.
export const APPOINTMENT_LOG_ACTIONS = [
  "APPOINTMENT_CREATED",
  "OTP_SENT",
  "OTP_VERIFIED",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DOCTOR",
  "CANCELLED_BY_ADMIN",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
  "MEDICAL_RESULT_CREATED",
  "INVOICE_CREATED",
  "PAYMENT_RECORDED",
  "INVOICE_CANCELLED",
  "PAYMENT_REFUNDED",
  "MEDICAL_RESULT_UPDATED",
  "MEDICAL_RESULT_PUBLISHED",
  "LAB_RESULT_CHANGED",
  "PRESCRIPTION_ISSUED",
  "PRESCRIPTION_CANCELLED",
  "PRESCRIPTION_DISPENSED",
] as const;
export type AppointmentLogAction = (typeof APPOINTMENT_LOG_ACTIONS)[number];

const PREFIXED_ACTIONS = new Set<AppointmentLogAction>([
  "OTP_SENT",
  "OTP_VERIFIED",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DOCTOR",
  "CANCELLED_BY_ADMIN",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
]);

export const toAppointmentAuditAction = (action: AppointmentLogAction) =>
  PREFIXED_ACTIONS.has(action) ? `APPOINTMENT_${action}` : action;

type LogClient = Prisma.TransactionClient | typeof prisma;

type SlotChange = {
  date?: Date | null;
  startTime?: string | null;
  endTime?: string | null;
};

export type AppointmentLogInput = {
  appointmentId: string;
  action: AppointmentLogAction;
  note?: string | null;
  actorId?: string | null;
  // Chỉ dùng khi dời lịch: khung giờ cũ và mới.
  from?: SlotChange;
  to?: SlotChange;
};

const slotMeta = (prefix: "old" | "new", change?: SlotChange): Record<string, string> => {
  const meta: Record<string, string> = {};
  if (change?.date) meta[`${prefix}Date`] = change.date.toISOString();
  if (change?.startTime) meta[`${prefix}StartTime`] = change.startTime;
  if (change?.endTime) meta[`${prefix}EndTime`] = change.endTime;
  return meta;
};

// Ghi cùng giao dịch với thao tác gốc (truyền `tx`) để không có thay đổi nào mà thiếu dấu vết.
export const writeAppointmentLog = async (client: LogClient, input: AppointmentLogInput) => {
  const actor = input.actorId
    ? await client.user.findUnique({
        where: { id: input.actorId },
        select: { fullName: true, role: true },
      })
    : null;

  const meta: Prisma.InputJsonObject = {
    ...(input.note ? { note: input.note } : {}),
    ...slotMeta("old", input.from),
    ...slotMeta("new", input.to),
  };

  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorName: actor?.fullName ?? null,
      actorRole: actor?.role ?? null,
      action: toAppointmentAuditAction(input.action),
      targetType: "APPOINTMENT",
      targetId: input.appointmentId,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  });
};

import type { DsTone } from "@/components/ds";
import type { AppointmentStatus } from "@/lib/types";

// Nhãn và màu trạng thái lịch hẹn dùng chung cho các màn hình mới.
export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  PENDING_OTP: "Chờ OTP",
  PENDING_CONFIRM: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn tất",
  RESCHEDULED: "Đổi lịch",
  CANCELLED_BY_PATIENT: "Bệnh nhân hủy",
  CANCELLED_BY_DOCTOR: "Bác sĩ hủy",
  CANCELLED_BY_ADMIN: "Quản trị hủy",
  NO_SHOW: "Vắng mặt",
};

export const appointmentStatusTone = (status: AppointmentStatus): DsTone => {
  if (status === "IN_PROGRESS") return "info";
  if (status === "COMPLETED") return "good";
  if (status === "CHECKED_IN" || status === "PENDING_CONFIRM") return "warn";
  if (status.startsWith("CANCELLED") || status === "NO_SHOW") return "bad";
  return "neutral";
};

// Trạng thái lịch hẹn và hóa đơn hiển thị cho người khám: nhãn, màu và các nhóm trạng thái.
// Một nguồn duy nhất cho cổng tài khoản; màu luôn đi kèm nhãn chữ.
export type StatusDisplay = { label: string; style: string };

const AMBER = "bg-amber-100 text-amber-800";
const GREEN = "bg-emerald-100 text-emerald-800";
const BLUE = "bg-blue-100 text-blue-800";
const VIOLET = "bg-violet-100 text-violet-800";
const GRAY = "bg-slate-200 text-slate-700";
const RED = "bg-red-100 text-red-700";
const NEUTRAL = "bg-slate-100 text-slate-700";

export const APPOINTMENT_STATUS: Record<string, StatusDisplay> = {
  PENDING_OTP: { label: "Chờ xác thực OTP", style: AMBER },
  PENDING_CONFIRM: { label: "Chờ xác nhận", style: AMBER },
  CONFIRMED: { label: "Đã xác nhận", style: GREEN },
  CHECKED_IN: { label: "Đã tiếp nhận", style: BLUE },
  IN_PROGRESS: { label: "Đang khám", style: BLUE },
  COMPLETED: { label: "Đã hoàn tất", style: GRAY },
  RESCHEDULED: { label: "Đã đổi lịch", style: VIOLET },
  CANCELLED_BY_PATIENT: { label: "Bạn đã hủy", style: RED },
  CANCELLED_BY_DOCTOR: { label: "Bác sĩ đã hủy", style: RED },
  CANCELLED_BY_ADMIN: { label: "Bệnh viện đã hủy", style: RED },
  NO_SHOW: { label: "Không đến khám", style: GRAY },
};

// Nhãn dài dùng ở trang chi tiết lịch hẹn.
export const APPOINTMENT_STATUS_DETAIL: Record<string, string> = {
  PENDING_OTP: "Chờ xác thực OTP",
  PENDING_CONFIRM: "Chờ bệnh viện xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã tiếp nhận",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Đã hoàn tất",
  RESCHEDULED: "Đã đổi lịch",
  CANCELLED_BY_PATIENT: "Bạn đã hủy lịch",
  CANCELLED_BY_DOCTOR: "Bác sĩ đã hủy lịch",
  CANCELLED_BY_ADMIN: "Bệnh viện đã hủy lịch",
  NO_SHOW: "Không đến khám",
};

export const APPOINTMENT_PROGRESS = ["PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"];

export const ACTIVE_APPOINTMENT_STATUSES = new Set(["PENDING_OTP", "PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "RESCHEDULED"]);
export const CANCELLED_APPOINTMENT_STATUSES = new Set(["CANCELLED_BY_PATIENT", "CANCELLED_BY_DOCTOR", "CANCELLED_BY_ADMIN", "NO_SHOW"]);
export const CANCELLABLE_APPOINTMENT_STATUSES = new Set(["PENDING_OTP", "PENDING_CONFIRM", "CONFIRMED", "RESCHEDULED"]);

export const appointmentStatusDisplay = (status: string): StatusDisplay =>
  APPOINTMENT_STATUS[status] || { label: status, style: NEUTRAL };

export const INVOICE_STATUS: Record<string, StatusDisplay> = {
  UNPAID: { label: "Chờ thanh toán", style: AMBER },
  PAID: { label: "Đã thanh toán", style: GREEN },
  CANCELLED: { label: "Đã hủy", style: GRAY },
  REFUNDED: { label: "Đã hoàn tiền", style: VIOLET },
};

export const invoiceStatusDisplay = (status: string): StatusDisplay =>
  INVOICE_STATUS[status] || { label: status, style: NEUTRAL };

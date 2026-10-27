import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

export const appointmentStatusOptions: Array<{
  value: "" | AppointmentStatus;
  label: string;
}> = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING_OTP", label: "Chờ mã xác thực" },
  { value: "PENDING_CONFIRM", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "CHECKED_IN", label: "Đã tiếp nhận" },
  { value: "IN_PROGRESS", label: "Đang khám" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "RESCHEDULED", label: "Đã đổi lịch" },
  { value: "NO_SHOW", label: "Không đến" },
  { value: "CANCELLED_BY_ADMIN", label: "Quản trị hủy" },
  { value: "CANCELLED_BY_DOCTOR", label: "Bác sĩ hủy" },
  { value: "CANCELLED_BY_PATIENT", label: "Bệnh nhân hủy" },
];

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  PENDING_OTP: "Chờ mã xác thực",
  PENDING_CONFIRM: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã tiếp nhận",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn thành",
  RESCHEDULED: "Đã đổi lịch",
  CANCELLED_BY_PATIENT: "Bệnh nhân hủy",
  CANCELLED_BY_DOCTOR: "Bác sĩ hủy",
  CANCELLED_BY_ADMIN: "Quản trị hủy",
  NO_SHOW: "Không đến",
};

const statusTone: Record<AppointmentStatus, string> = {
  PENDING_OTP: "ui-status-warning",
  PENDING_CONFIRM: "ui-status-warning",
  CONFIRMED: "ui-status-positive",
  CHECKED_IN: "ui-status-info",
  IN_PROGRESS: "ui-status-info",
  COMPLETED: "ui-status-positive",
  RESCHEDULED: "ui-status-neutral",
  CANCELLED_BY_PATIENT: "ui-status-danger",
  CANCELLED_BY_DOCTOR: "ui-status-danger",
  CANCELLED_BY_ADMIN: "ui-status-danger",
  NO_SHOW: "ui-status-warning",
};

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1.5 px-2.5", statusTone[status], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {appointmentStatusLabel[status]}
    </Badge>
  );
}

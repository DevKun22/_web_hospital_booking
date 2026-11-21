import type { DsTone } from "@/components/ds";
import { getVietnamDateInput, isVietnamSlotStartInPast } from "@/lib/date";
import type {
  DoctorProfile,
  DoctorSchedule,
  DoctorTimeSlot,
  ScheduleChangeRequest,
  ScheduleChangeRequestStatus,
  TimeSlotStatus,
} from "@/lib/types";

// Lịch bác sĩ: kiểu, nhãn và phép tính thuần tách khỏi trang để kiểm thử được.
export type ScheduleForm = {
  doctorId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: string;
  isActive: boolean;
  facilityId: string;
};

export type SlotReconciliationFinding = {
  type: "ORPHAN_BOOKED_SLOT" | "LINKED_SLOT_NOT_BOOKED" | "TERMINAL_APPOINTMENT_STILL_LINKED" | "APPOINTMENT_SLOT_MISMATCH";
  slotId: string;
  appointmentId: string | null;
  repaired: boolean;
};

export type SlotReconciliationResult = {
  policy: { weeklyScheduleChangesAffect: string; bookedSlots: string; unsafeMismatchRepair: string };
  scanned: number;
  findingCount: number;
  repairedCount: number;
  findings: SlotReconciliationFinding[];
};

export type PaneState =
  | { kind: "slot"; id: string }
  | { kind: "schedule"; id: string }
  | { kind: "newSchedule" }
  | { kind: "generate" }
  | { kind: "timeOff" }
  | { kind: "reconcile" }
  | { kind: "request"; id: string }
  | { kind: "newRequest"; scheduleId?: string }
  | null;

export const reconciliationFindingLabels: Record<SlotReconciliationFinding["type"], string> = {
  ORPHAN_BOOKED_SLOT: "Khung giờ báo đã đặt nhưng không còn lịch hẹn",
  LINKED_SLOT_NOT_BOOKED: "Khung giờ có lịch hẹn nhưng trạng thái chưa đồng bộ",
  TERMINAL_APPOINTMENT_STILL_LINKED: "Lịch đã kết thúc nhưng vẫn giữ khung giờ",
  APPOINTMENT_SLOT_MISMATCH: "Thông tin lịch hẹn và khung giờ không khớp",
};

export const emptyScheduleForm: ScheduleForm = { doctorId: "", dayOfWeek: "1", startTime: "08:00", endTime: "11:30", slotDuration: "30", isActive: true, facilityId: "" };


export const slotStatusOptions: { value: "" | TimeSlotStatus; label: string }[] = [
  { value: "", label: "Mọi trạng thái" },
  { value: "AVAILABLE", label: "Còn trống" },
  { value: "BOOKED", label: "Đã đặt" },
  { value: "LOCKED", label: "Đã khoá" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

export const slotLabel: Record<TimeSlotStatus, string> = { AVAILABLE: "Còn trống", BOOKED: "Đã đặt", LOCKED: "Đã khoá", CANCELLED: "Đã huỷ" };
export const slotTone: Record<TimeSlotStatus, DsTone> = { AVAILABLE: "good", BOOKED: "info", LOCKED: "warn", CANCELLED: "neutral" };

export const effectiveSlotStatus = (slot: DoctorTimeSlot) =>
  slot.status === "AVAILABLE" && isVietnamSlotStartInPast(slot.date, slot.startTime)
    ? { label: "Đã qua giờ", tone: "neutral" as DsTone, note: "Ẩn trên website người dùng" }
    : { label: slotLabel[slot.status], tone: slotTone[slot.status], note: "" };

export const requestStatusLabel: Record<ScheduleChangeRequestStatus, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", CANCELLED: "Đã hủy" };
export const requestStatusTone: Record<ScheduleChangeRequestStatus, DsTone> = { PENDING: "warn", APPROVED: "good", REJECTED: "bad", CANCELLED: "neutral" };

export const today = () => getVietnamDateInput();

export const addDaysToInput = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export type ScheduleImpact = {
  generatedSlots: number;
  removedSlots: number;
  affected: { appointmentId: string; bookingCode: string; patientName: string; date: string; startTime: string }[];
};

// Câu báo kết quả sau khi đổi/tắt/xóa/duyệt lịch mẫu: nói rõ bao nhiêu khung giờ được gỡ/sinh và bao nhiêu lịch đã đặt cần xử lý.
export const impactText = (impact?: ScheduleImpact | null) => {
  if (!impact) return "";
  const parts: string[] = [];
  if (impact.removedSlots) parts.push(`gỡ ${impact.removedSlots} khung giờ trống`);
  if (impact.generatedSlots) parts.push(`sinh ${impact.generatedSlots} khung giờ mới`);
  if (impact.affected.length) parts.push(`${impact.affected.length} lịch đã đặt cần liên hệ người khám để đổi (nhân viên đã được báo)`);
  return parts.length ? ` Hệ thống đã ${parts.join(", ")}.` : "";
};

export type RangeResult = { lockedSlots?: number; reopenedSlots?: number; affected?: ScheduleImpact["affected"] };

export const doctorName = (doctor: DoctorSchedule["doctor"] | DoctorProfile | ScheduleChangeRequest["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

export const toScheduleForm = (schedule: DoctorSchedule): ScheduleForm => ({
  doctorId: schedule.doctor.id,
  dayOfWeek: String(schedule.dayOfWeek),
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  slotDuration: String(schedule.slotDuration),
  isActive: schedule.isActive,
  facilityId: schedule.facilityId ?? "",
});

export const buildUpdateSchedulePayload = (form: ScheduleForm) => ({
  dayOfWeek: Number(form.dayOfWeek),
  startTime: form.startTime,
  endTime: form.endTime,
  slotDuration: Number(form.slotDuration || 30),
  isActive: form.isActive,
  // Để trống: giữ cơ sở hiện tại (ca mới nhận cơ sở mặc định).
  facilityId: form.facilityId || undefined,
});

export const buildCreateSchedulePayload = (form: ScheduleForm) => ({ doctorId: form.doctorId, ...buildUpdateSchedulePayload(form) });


export const viewTabs = (showRequests: boolean, pending: number) => [
  { id: "slots", label: "Khung giờ khám" },
  { id: "schedules", label: "Lịch mẫu theo tuần" },
  ...(showRequests ? [{ id: "requests", label: "Yêu cầu đổi lịch", count: pending }] : []),
];

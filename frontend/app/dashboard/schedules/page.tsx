"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Wrench } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
  DsKeyValue,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
  type DsColumn,
  type DsTone,
} from "@/components/ds";
import { ScheduleRequestForm, requestTypeLabels, scheduleDays } from "@/components/schedules/schedule-request-form";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDoctorSchedules, useDashboardDoctorTimeSlots, useDashboardScheduleDoctors } from "@/lib/dashboard-schedules-query";
import { formatVietnamDate, getVietnamDateInput, isVietnamSlotStartInPast } from "@/lib/date";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type {
  DoctorProfile,
  DoctorSchedule,
  DoctorTimeSlot,
  ListResult,
  ScheduleChangeRequest,
  ScheduleChangeRequestStatus,
  TimeSlotStatus,
} from "@/lib/types";

// Lịch bác sĩ: ba góc nhìn (khung giờ theo ngày, lịch mẫu theo tuần, yêu cầu đổi lịch) dùng chung một khung làm việc bên phải;
// chọn một dòng hoặc bấm công cụ thì khung mở cạnh danh sách, không che nội dung.

type ScheduleForm = {
  doctorId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: string;
  maxPatients: string;
  isActive: boolean;
};

type SlotReconciliationFinding = {
  type: "ORPHAN_BOOKED_SLOT" | "LINKED_SLOT_NOT_BOOKED" | "TERMINAL_APPOINTMENT_STILL_LINKED" | "APPOINTMENT_SLOT_MISMATCH";
  slotId: string;
  appointmentId: string | null;
  repaired: boolean;
};

type SlotReconciliationResult = {
  policy: { weeklyScheduleChangesAffect: string; bookedSlots: string; unsafeMismatchRepair: string };
  scanned: number;
  findingCount: number;
  repairedCount: number;
  findings: SlotReconciliationFinding[];
};

type PaneState =
  | { kind: "slot"; id: string }
  | { kind: "schedule"; id: string }
  | { kind: "newSchedule" }
  | { kind: "generate" }
  | { kind: "timeOff" }
  | { kind: "reconcile" }
  | { kind: "request"; id: string }
  | { kind: "newRequest"; scheduleId?: string }
  | null;

const reconciliationFindingLabels: Record<SlotReconciliationFinding["type"], string> = {
  ORPHAN_BOOKED_SLOT: "Khung giờ báo đã đặt nhưng không còn lịch hẹn",
  LINKED_SLOT_NOT_BOOKED: "Khung giờ có lịch hẹn nhưng trạng thái chưa đồng bộ",
  TERMINAL_APPOINTMENT_STILL_LINKED: "Lịch đã kết thúc nhưng vẫn giữ khung giờ",
  APPOINTMENT_SLOT_MISMATCH: "Thông tin lịch hẹn và khung giờ không khớp",
};

const emptyScheduleForm: ScheduleForm = { doctorId: "", dayOfWeek: "1", startTime: "08:00", endTime: "11:30", slotDuration: "30", maxPatients: "1", isActive: true };

const dayOptions = scheduleDays.map((label, index) => ({ value: String(index), label }));

const slotStatusOptions: { value: "" | TimeSlotStatus; label: string }[] = [
  { value: "", label: "Mọi trạng thái" },
  { value: "AVAILABLE", label: "Còn trống" },
  { value: "BOOKED", label: "Đã đặt" },
  { value: "LOCKED", label: "Đã khoá" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

const slotLabel: Record<TimeSlotStatus, string> = { AVAILABLE: "Còn trống", BOOKED: "Đã đặt", LOCKED: "Đã khoá", CANCELLED: "Đã huỷ" };
const slotTone: Record<TimeSlotStatus, DsTone> = { AVAILABLE: "good", BOOKED: "info", LOCKED: "warn", CANCELLED: "neutral" };

const effectiveSlotStatus = (slot: DoctorTimeSlot) =>
  slot.status === "AVAILABLE" && isVietnamSlotStartInPast(slot.date, slot.startTime)
    ? { label: "Đã qua giờ", tone: "neutral" as DsTone, note: "Ẩn trên website người dùng" }
    : { label: slotLabel[slot.status], tone: slotTone[slot.status], note: "" };

const requestStatusLabel: Record<ScheduleChangeRequestStatus, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", CANCELLED: "Đã hủy" };
const requestStatusTone: Record<ScheduleChangeRequestStatus, DsTone> = { PENDING: "warn", APPROVED: "good", REJECTED: "bad", CANCELLED: "neutral" };

const today = () => getVietnamDateInput();

const addDaysToInput = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

type ScheduleImpact = {
  generatedSlots: number;
  removedSlots: number;
  affected: { appointmentId: string; bookingCode: string; patientName: string; date: string; startTime: string }[];
};

// Câu báo kết quả sau khi đổi/tắt/xóa/duyệt lịch mẫu: nói rõ bao nhiêu khung giờ được gỡ/sinh và bao nhiêu lịch đã đặt cần xử lý.
const impactText = (impact?: ScheduleImpact | null) => {
  if (!impact) return "";
  const parts: string[] = [];
  if (impact.removedSlots) parts.push(`gỡ ${impact.removedSlots} khung giờ trống`);
  if (impact.generatedSlots) parts.push(`sinh ${impact.generatedSlots} khung giờ mới`);
  if (impact.affected.length) parts.push(`${impact.affected.length} lịch đã đặt cần liên hệ người khám để đổi (nhân viên đã được báo)`);
  return parts.length ? ` Hệ thống đã ${parts.join(", ")}.` : "";
};

type RangeResult = { lockedSlots?: number; reopenedSlots?: number; affected?: ScheduleImpact["affected"] };

const doctorName = (doctor: DoctorSchedule["doctor"] | DoctorProfile | ScheduleChangeRequest["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const toScheduleForm = (schedule: DoctorSchedule): ScheduleForm => ({
  doctorId: schedule.doctor.id,
  dayOfWeek: String(schedule.dayOfWeek),
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  slotDuration: String(schedule.slotDuration),
  maxPatients: String(schedule.maxPatients),
  isActive: schedule.isActive,
});

const buildUpdateSchedulePayload = (form: ScheduleForm) => ({
  dayOfWeek: Number(form.dayOfWeek),
  startTime: form.startTime,
  endTime: form.endTime,
  slotDuration: Number(form.slotDuration || 30),
  maxPatients: Number(form.maxPatients || 1),
  isActive: form.isActive,
});

const buildCreateSchedulePayload = (form: ScheduleForm) => ({ doctorId: form.doctorId, ...buildUpdateSchedulePayload(form) });

const dayLabel = (day: number) => scheduleDays[day] ?? "";

const viewTabs = (showRequests: boolean, pending: number) => [
  { id: "slots", label: "Khung giờ khám" },
  { id: "schedules", label: "Lịch mẫu theo tuần" },
  ...(showRequests ? [{ id: "requests", label: "Yêu cầu đổi lịch", count: pending }] : []),
];

export default function SchedulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"slots" | "schedules" | "requests">("slots");
  const [pane, setPane] = useState<PaneState>(null);
  const [doctorId, setDoctorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [scheduleActive, setScheduleActive] = useState("");
  const [slotDoctorId, setSlotDoctorId] = useState("");
  const [slotDate, setSlotDate] = useState(today());
  const [slotStatus, setSlotStatus] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [schedulePage, setSchedulePage] = useState(1);
  const [slotPage, setSlotPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [generateDoctorId, setGenerateDoctorId] = useState("");
  const [generateFrom, setGenerateFrom] = useState(today());
  const [generateTo, setGenerateTo] = useState(addDaysToInput(today(), 13));
  const [offDoctorId, setOffDoctorId] = useState("");
  const [offFrom, setOffFrom] = useState(today());
  const [offTo, setOffTo] = useState(today());
  const [offReason, setOffReason] = useState("");
  const [offResult, setOffResult] = useState<RangeResult | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<SlotReconciliationResult | null>(null);
  const [reconciling, setReconciling] = useState<"scan" | "repair" | null>(null);

  const canWrite = can(user, "schedule.manage");
  const canReconcile = can(user, "schedule.reconcile");
  const isDoctor = user?.role === "DOCTOR";
  const canManageSlots = canWrite || isDoctor;
  const canLockRange = can(user, "schedule.lock");
  const showRequests = canWrite || Boolean(isDoctor);

  const scheduleQuery = useMemo(
    () => ({ doctorId: isDoctor ? undefined : doctorId || undefined, dayOfWeek: dayOfWeek || undefined, isActive: scheduleActive || undefined, page: schedulePage, limit: 20 }),
    [dayOfWeek, doctorId, isDoctor, scheduleActive, schedulePage],
  );
  const slotQuery = useMemo(
    () => ({ doctorId: isDoctor ? undefined : slotDoctorId || undefined, date: slotDate || undefined, status: slotStatus || undefined, page: slotPage, limit: 30 }),
    [isDoctor, slotDate, slotDoctorId, slotPage, slotStatus],
  );
  // Người quản lý mặc định thấy yêu cầu chờ duyệt; bác sĩ thấy mọi yêu cầu của mình.
  const requestFilters = useMemo(() => ({ status: isDoctor ? requestStatus || undefined : requestStatus || "PENDING", limit: 20 }), [isDoctor, requestStatus]);
  const doctorQuery = useMemo(() => ({ isAvailable: "true", limit: 100 }), []);
  const doctorsQuery = useDashboardScheduleDoctors(doctorQuery, !isDoctor && can(user, "catalog.view"));
  const schedulesQuery = useDashboardDoctorSchedules(scheduleQuery);
  const slotsQuery = useDashboardDoctorTimeSlots(slotQuery);
  const requestsQuery = useQuery({
    queryKey: queryKeys.dashboardScheduleChangeRequests(requestFilters),
    queryFn: () => apiRequest<ListResult<ScheduleChangeRequest>>("/dashboard/schedule-change-requests", { query: requestFilters }),
    enabled: showRequests,
  });
  const pendingQuery = useQuery({
    queryKey: queryKeys.dashboardScheduleChangeRequests({ status: "PENDING", limit: 1 }),
    queryFn: () => apiRequest<ListResult<ScheduleChangeRequest>>("/dashboard/schedule-change-requests", { query: { status: "PENDING", limit: 1 } }),
    enabled: showRequests,
  });

  const doctors = doctorsQuery.data?.items ?? [];
  const schedules = schedulesQuery.data?.items ?? [];
  const slots = slotsQuery.data?.items ?? [];
  const requests = requestsQuery.data?.items ?? [];
  const pendingCount = pendingQuery.data?.pagination.total ?? 0;
  const schedulePagination = schedulesQuery.data?.pagination ?? { page: schedulePage, limit: 20, total: 0, totalPages: 1 };
  const slotPagination = slotsQuery.data?.pagination ?? { page: slotPage, limit: 30, total: 0, totalPages: 1 };
  const queryError = doctorsQuery.error || schedulesQuery.error || slotsQuery.error || requestsQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu lịch khám") : "";
  const visibleError = error || queryErrorMessage;
  const hasRepairable = Boolean(reconciliationResult?.findings.some((finding) => finding.type !== "APPOINTMENT_SLOT_MISMATCH" && !finding.repaired));

  const selectedSlot = pane?.kind === "slot" ? slots.find((item) => item.id === pane.id) ?? null : null;
  const selectedSchedule = pane?.kind === "schedule" ? schedules.find((item) => item.id === pane.id) ?? null : null;
  const selectedRequest = pane?.kind === "request" ? requests.find((item) => item.id === pane.id) ?? null : null;

  const invalidateSchedules = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "schedule-change-requests"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
  };

  const invalidateSlots = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-time-slots"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "available-slots"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
  };

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const resetEditors = () => {
    setConfirmDelete(false);
    setLockOpen(false);
    setLockReason("");
    setRejecting(false);
    setReviewerNote("");
  };

  const openPane = (next: PaneState) => {
    resetEditors();
    setError("");
    setPane(next);
  };

  const closePane = () => {
    resetEditors();
    setPane(null);
  };

  const changeView = (next: string) => {
    setView(next as typeof view);
    closePane();
  };

  const openSlot = (slot: DoctorTimeSlot) => openPane({ kind: "slot", id: slot.id });

  const openSchedule = (schedule: DoctorSchedule) => {
    setScheduleForm(toScheduleForm(schedule));
    openPane({ kind: "schedule", id: schedule.id });
  };

  const startNewSchedule = () => {
    setView("schedules");
    setScheduleForm(emptyScheduleForm);
    openPane({ kind: "newSchedule" });
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (pane?.kind === "schedule") {
        const updated = await apiRequest<DoctorSchedule & { impact?: ScheduleImpact }>(`/dashboard/doctor-schedules/${pane.id}`, { method: "PATCH", body: buildUpdateSchedulePayload(scheduleForm) });
        setNotice(`Đã cập nhật lịch làm việc.${impactText(updated.impact)}`);
        await invalidateSlots();
      } else {
        const created = await apiRequest<DoctorSchedule & { impact?: ScheduleImpact }>("/dashboard/doctor-schedules", { method: "POST", body: buildCreateSchedulePayload(scheduleForm) });
        setNotice(`Đã tạo lịch làm việc.${impactText(created.impact)}`);
        await invalidateSlots();
        closePane();
      }
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được lịch làm việc");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async () => {
    if (!canWrite || pane?.kind !== "schedule") return;
    setError("");
    setNotice("");
    try {
      const removed = await apiRequest<DoctorSchedule & { impact?: ScheduleImpact }>(`/dashboard/doctor-schedules/${pane.id}`, { method: "DELETE" });
      setNotice(`Đã xoá lịch làm việc.${impactText(removed.impact)}`);
      await invalidateSlots();
      closePane();
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được lịch làm việc");
    }
  };

  const generateSlots = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ generatedCount: number; days: number }>("/dashboard/doctor-time-slots/generate-range", {
        method: "POST",
        body: { doctorId: generateDoctorId, from: generateFrom, to: generateTo },
      });
      setView("slots");
      setSlotDoctorId(generateDoctorId);
      setSlotDate(generateFrom);
      setSlotPage(1);
      setNotice(result.generatedCount ? `Đã sinh ${result.generatedCount} khung giờ trong ${result.days} ngày.` : `Không có khung giờ mới: các ngày này đã có đủ khung giờ.`);
      closePane();
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được khung giờ");
    } finally {
      setSaving(false);
    }
  };

  // Nghỉ phép/họp/việc đột xuất: đóng (hoặc mở lại) mọi khung giờ trống của bác sĩ trong khoảng ngày.
  const ownDoctorId = schedules[0]?.doctor?.id ?? "";
  const runRange = async (kind: "close" | "reopen") => {
    const targetDoctorId = isDoctor ? ownDoctorId : offDoctorId;
    if (!targetDoctorId) {
      setError(isDoctor ? "Chưa có lịch mẫu nào gắn với tài khoản bác sĩ của bạn" : "Chọn bác sĩ");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<RangeResult>(`/dashboard/doctor-time-slots/${kind === "close" ? "close-range" : "reopen-range"}`, {
        method: "POST",
        body: kind === "close" ? { doctorId: targetDoctorId, from: offFrom, to: offTo, reason: offReason.trim() } : { doctorId: targetDoctorId, from: offFrom, to: offTo },
      });
      setOffResult(result);
      setNotice(
        kind === "close"
          ? `Đã đóng ${result.lockedSlots ?? 0} khung giờ trống.${result.affected?.length ? ` Có ${result.affected.length} lịch đã đặt cần liên hệ người khám (nhân viên đã được báo).` : ""}`
          : `Đã mở lại ${result.reopenedSlots ?? 0} khung giờ.`,
      );
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được khoảng ngày");
    } finally {
      setSaving(false);
    }
  };

  const setSlotStatusTo = async (slot: DoctorTimeSlot, status: TimeSlotStatus) => {
    if (!canWrite) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/status`, { method: "PATCH", body: { status, lockReason: null } });
      setNotice("Đã cập nhật khung giờ");
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được khung giờ");
    }
  };

  const lockSlot = async (slot: DoctorTimeSlot) => {
    if (!canManageSlots) return;
    const reason = lockReason.trim();
    if (reason.length < 2) {
      setError("Lý do khóa khung giờ cần có ít nhất 2 ký tự");
      return;
    }
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/lock`, { method: "PATCH", body: { lockReason: reason } });
      setNotice("Đã khóa khung giờ khám");
      setLockOpen(false);
      setLockReason("");
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không khóa được khung giờ");
    } finally {
      setSaving(false);
    }
  };

  const unlockSlot = async (slot: DoctorTimeSlot) => {
    if (!canManageSlots) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/unlock`, { method: "PATCH" });
      setNotice("Đã mở khóa khung giờ");
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở khóa được khung giờ");
    }
  };

  const deleteSlot = async (slot: DoctorTimeSlot) => {
    if (!canWrite) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}`, { method: "DELETE" });
      setNotice("Đã xoá khung giờ");
      closePane();
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được khung giờ");
    }
  };

  const reconcileSlots = async (repair: boolean) => {
    if (!canReconcile) return;
    setReconciling(repair ? "repair" : "scan");
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<SlotReconciliationResult>("/dashboard/doctor-time-slots/reconcile", { method: "POST", body: { repair, batchSize: 500 } });
      setReconciliationResult(result);
      setNotice(
        repair
          ? `Đã đối soát ${result.scanned} khung giờ và sửa ${result.repairedCount} sai lệch an toàn.`
          : `Đã kiểm tra ${result.scanned} khung giờ, phát hiện ${result.findingCount} sai lệch.`,
      );
      if (repair && result.repairedCount > 0) await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đối soát khung giờ");
    } finally {
      setReconciling(null);
    }
  };

  const reviewRequest = async (request: ScheduleChangeRequest, status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !reviewerNote.trim()) {
      setError("Cần nêu lý do từ chối yêu cầu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const reviewed = await apiRequest<ScheduleChangeRequest & { impact?: ScheduleImpact }>(`/dashboard/schedule-change-requests/${request.id}/review`, {
        method: "PATCH",
        body: { status, reviewerNote: reviewerNote.trim() || null },
      });
      if (status === "APPROVED") await invalidateSlots();
      setNotice(status === "APPROVED" ? `Đã duyệt và áp dụng lịch mẫu.${impactText(reviewed.impact)}` : "Đã từ chối yêu cầu đổi lịch.");
      resetEditors();
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được yêu cầu");
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (request: ScheduleChangeRequest) => {
    setSaving(true);
    setError("");
    try {
      await apiRequest<ScheduleChangeRequest>(`/dashboard/schedule-change-requests/${request.id}/cancel`, { method: "PATCH" });
      setNotice("Đã hủy yêu cầu đổi lịch.");
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy được yêu cầu");
    } finally {
      setSaving(false);
    }
  };

  const slotColumns: DsColumn<DoctorTimeSlot>[] = [
    {
      key: "time",
      header: "Thời gian",
      cell: (row) => (
        <div>
          <strong>{formatVietnamDate(row.date)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.startTime} - {row.endTime}
          </div>
        </div>
      ),
    },
    ...(!isDoctor
      ? [
          {
            key: "doctor",
            header: "Bác sĩ",
            cell: (row: DoctorTimeSlot) => (
              <div>
                {doctorName(row.doctor)}
                <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.doctor.department.name}</div>
              </div>
            ),
          } satisfies DsColumn<DoctorTimeSlot>,
        ]
      : []),
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const status = effectiveSlotStatus(row);
        return (
          <div>
            <DsStatusPill tone={status.tone}>{status.label}</DsStatusPill>
            {row.lockReason ? <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.lockReason}</div> : null}
          </div>
        );
      },
    },
    { key: "appointment", header: "Lịch hẹn", cell: (row) => (row.appointment?.bookingCode ? <span className="ds-mono">{row.appointment.bookingCode}</span> : "-") },
  ];

  const scheduleColumns: DsColumn<DoctorSchedule>[] = [
    {
      key: "doctor",
      header: "Bác sĩ",
      cell: (row) => (
        <div>
          <strong>{doctorName(row.doctor)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.doctor.department.name}</div>
        </div>
      ),
    },
    { key: "day", header: "Thứ", cell: (row) => dayLabel(row.dayOfWeek) },
    { key: "hours", header: "Giờ", cell: (row) => `${row.startTime} - ${row.endTime}` },
    { key: "slot", header: "Khung giờ", cell: (row) => `${row.slotDuration} phút / tối đa ${row.maxPatients}` },
    { key: "active", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.isActive ? "good" : "neutral"}>{row.isActive ? "Đang dùng" : "Tạm tắt"}</DsStatusPill> },
  ];

  const requestColumns: DsColumn<ScheduleChangeRequest>[] = [
    {
      key: "who",
      header: isDoctor ? "Yêu cầu" : "Bác sĩ",
      cell: (row) => (
        <div>
          <strong>{isDoctor ? requestTypeLabels[row.type] : doctorName(row.doctor)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{isDoctor ? "" : requestTypeLabels[row.type]}</div>
        </div>
      ),
    },
    {
      key: "proposal",
      header: "Đề xuất",
      cell: (row) => (
        <div>
          {dayLabel(row.dayOfWeek)} · {row.startTime} - {row.endTime}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>từ {formatVietnamDate(row.effectiveFrom)}</div>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={requestStatusTone[row.status]}>{requestStatusLabel[row.status]}</DsStatusPill> },
  ];

  // Khung bên phải chỉ mở khi có nội dung hiển thị được (đúng quyền, mục chọn còn trong danh sách).
  const open =
    pane !== null &&
    (pane.kind === "slot"
      ? Boolean(selectedSlot)
      : pane.kind === "schedule"
        ? Boolean(selectedSchedule)
        : pane.kind === "request"
          ? Boolean(selectedRequest)
          : pane.kind === "timeOff"
            ? canLockRange
          : pane.kind === "newSchedule" || pane.kind === "generate"
            ? canWrite
            : pane.kind === "reconcile"
              ? canReconcile
              : Boolean(isDoctor));

  const doctorSelect = (value: string, onChange: (next: string) => void, label: string) => (
    <div style={{ minWidth: 160, flex: "1 1 180px" }}>
      <DsSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả bác sĩ</option>
        {doctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctorName(doctor)}
          </option>
        ))}
      </DsSelect>
    </div>
  );

  const pager = (current: number, total: number, count: number, set: (updater: (page: number) => number) => void, unit: string) => (
    <div className="ds-pager">
      <span>
        {count} {unit} · trang {current}/{total || 1}
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        <DsButton disabled={current <= 1} onClick={() => set((page) => Math.max(page - 1, 1))}>
          Trước
        </DsButton>
        <DsButton disabled={current >= total} onClick={() => set((page) => page + 1)}>
          Sau
        </DsButton>
      </span>
    </div>
  );

  const slotsView = (
    <>
      <DsToolbar>
        {!isDoctor ? doctorSelect(slotDoctorId, (next) => { setSlotDoctorId(next); setSlotPage(1); }, "Lọc khung giờ theo bác sĩ") : null}
        <div style={{ minWidth: 150, flex: "0 1 170px" }}>
          <VietnamDateInput value={slotDate} onChange={(value) => { setSlotDate(value); setSlotPage(1); }} ariaLabel="Ngày lọc khung giờ" className="ds-input" />
        </div>
        <DsButton variant="ghost" onClick={() => { setSlotDate(today()); setSlotPage(1); }}>
          Hôm nay
        </DsButton>
        {slotDate ? (
          <DsButton variant="ghost" onClick={() => { setSlotDate(""); setSlotPage(1); }}>
            Mọi ngày
          </DsButton>
        ) : null}
        <div style={{ minWidth: 140, flex: "0 1 170px" }}>
          <DsSelect aria-label="Lọc khung giờ theo trạng thái" value={slotStatus} onChange={(event) => { setSlotStatus(event.target.value); setSlotPage(1); }}>
            {slotStatusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </DsSelect>
        </div>
      </DsToolbar>
      {open ? (
        slots.length ? (
          <div role="listbox" aria-label="Danh sách khung giờ">
            {slots.map((slot) => {
              const status = effectiveSlotStatus(slot);
              return (
                <button key={slot.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "slot" && pane.id === slot.id} onClick={() => openSlot(slot)}>
                  <span className="ds-listrow__main">
                    <strong>
                      {formatVietnamDate(slot.date)} · {slot.startTime} - {slot.endTime}
                    </strong>
                    <small>{isDoctor ? slot.appointment?.bookingCode || "Chưa có lịch hẹn" : doctorName(slot.doctor)}</small>
                  </span>
                  <DsStatusPill tone={status.tone}>{status.label}</DsStatusPill>
                </button>
              );
            })}
          </div>
        ) : (
          <DsEmptyState title="Chưa có khung giờ phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách khung giờ khám"
          columns={slotColumns}
          rows={slots}
          rowKey={(row) => row.id}
          loading={slotsQuery.isLoading}
          emptyTitle="Chưa có khung giờ phù hợp"
          emptyDescription={canWrite ? "Đổi bộ lọc hoặc bấm Tạo khung giờ để sinh khung giờ từ lịch mẫu." : "Đổi ngày hoặc bộ lọc để xem khung giờ khác."}
          onRowClick={openSlot}
        />
      )}
      {pager(slotPagination.page, slotPagination.totalPages, slotPagination.total, setSlotPage, "khung giờ")}
    </>
  );

  const schedulesView = (
    <>
      <DsToolbar>
        {!isDoctor ? doctorSelect(doctorId, (next) => { setDoctorId(next); setSchedulePage(1); }, "Lọc lịch mẫu theo bác sĩ") : null}
        <div style={{ minWidth: 130, flex: "0 1 160px" }}>
          <DsSelect aria-label="Lọc theo thứ" value={dayOfWeek} onChange={(event) => { setDayOfWeek(event.target.value); setSchedulePage(1); }}>
            <option value="">Mọi thứ</option>
            {dayOptions.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </DsSelect>
        </div>
        <div style={{ minWidth: 130, flex: "0 1 160px" }}>
          <DsSelect aria-label="Lọc theo trạng thái lịch mẫu" value={scheduleActive} onChange={(event) => { setScheduleActive(event.target.value); setSchedulePage(1); }}>
            <option value="">Mọi trạng thái</option>
            <option value="true">Đang dùng</option>
            <option value="false">Tạm tắt</option>
          </DsSelect>
        </div>
      </DsToolbar>
      {open ? (
        schedules.length ? (
          <div role="listbox" aria-label="Danh sách lịch mẫu">
            {schedules.map((schedule) => (
              <button key={schedule.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "schedule" && pane.id === schedule.id} onClick={() => openSchedule(schedule)}>
                <span className="ds-listrow__main">
                  <strong>
                    {dayLabel(schedule.dayOfWeek)} · {schedule.startTime} - {schedule.endTime}
                  </strong>
                  <small>{isDoctor ? `${schedule.slotDuration} phút / khung` : doctorName(schedule.doctor)}</small>
                </span>
                <DsStatusPill tone={schedule.isActive ? "good" : "neutral"}>{schedule.isActive ? "Đang dùng" : "Tạm tắt"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có lịch mẫu" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách lịch mẫu theo tuần"
          columns={scheduleColumns}
          rows={schedules}
          rowKey={(row) => row.id}
          loading={schedulesQuery.isLoading}
          emptyTitle="Chưa có lịch mẫu"
          emptyDescription={canWrite ? "Bấm Tạo lịch mẫu để thêm lịch làm việc theo tuần cho bác sĩ." : undefined}
          onRowClick={openSchedule}
        />
      )}
      {pager(schedulePagination.page, schedulePagination.totalPages, schedulePagination.total, setSchedulePage, "lịch mẫu")}
    </>
  );

  const requestsView = (
    <>
      <DsToolbar>
        <div style={{ minWidth: 150, flex: "0 1 200px" }}>
          <DsSelect aria-label="Lọc yêu cầu theo trạng thái" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}>
            {isDoctor ? <option value="">Mọi trạng thái</option> : null}
            <option value={isDoctor ? "PENDING" : ""}>Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </DsSelect>
        </div>
        {isDoctor ? (
          <DsButton variant="primary" onClick={() => openPane({ kind: "newRequest" })}>
            <Plus aria-hidden="true" />
            Gửi yêu cầu mới
          </DsButton>
        ) : null}
      </DsToolbar>
      {open ? (
        requests.length ? (
          <div role="listbox" aria-label="Danh sách yêu cầu đổi lịch">
            {requests.map((request) => (
              <button key={request.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "request" && pane.id === request.id} onClick={() => openPane({ kind: "request", id: request.id })}>
                <span className="ds-listrow__main">
                  <strong>{isDoctor ? requestTypeLabels[request.type] : doctorName(request.doctor)}</strong>
                  <small>
                    {dayLabel(request.dayOfWeek)} · {request.startTime} - {request.endTime}
                  </small>
                </span>
                <DsStatusPill tone={requestStatusTone[request.status]}>{requestStatusLabel[request.status]}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có yêu cầu" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách yêu cầu đổi lịch"
          columns={requestColumns}
          rows={requests}
          rowKey={(row) => row.id}
          loading={requestsQuery.isLoading}
          emptyTitle={isDoctor ? "Bạn chưa có yêu cầu đổi lịch nào" : "Không có yêu cầu nào đang chờ duyệt"}
          emptyDescription={isDoctor ? "Bấm Gửi yêu cầu mới để đề nghị đổi lịch mẫu." : undefined}
          onRowClick={(row) => openPane({ kind: "request", id: row.id })}
        />
      )}
    </>
  );

  const list = (
    <DsPanel flush>
      <DsTabs label="Chế độ xem lịch bác sĩ" items={viewTabs(showRequests, pendingCount)} value={view} onChange={changeView} />
      {view === "slots" ? slotsView : view === "schedules" ? schedulesView : requestsView}
    </DsPanel>
  );

  const scheduleFormFields = (editing: boolean) => (
    <form onSubmit={saveSchedule} style={{ display: "grid", gap: 12 }} aria-label={editing ? "Cập nhật lịch mẫu" : "Tạo lịch mẫu"}>
      <DsField label="Bác sĩ" htmlFor="sf-doctor" required={!editing}>
        {editing && selectedSchedule ? (
          <DsInput id="sf-doctor" value={doctorName(selectedSchedule.doctor)} disabled readOnly />
        ) : (
          <DsSelect id="sf-doctor" value={scheduleForm.doctorId} required onChange={(event) => setScheduleForm((current) => ({ ...current, doctorId: event.target.value }))}>
            <option value="">Chọn bác sĩ</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctorName(doctor)}
              </option>
            ))}
          </DsSelect>
        )}
      </DsField>
      <div className="ds-grid-fields">
        <DsField label="Thứ trong tuần" htmlFor="sf-day">
          <DsSelect id="sf-day" value={scheduleForm.dayOfWeek} onChange={(event) => setScheduleForm((current) => ({ ...current, dayOfWeek: event.target.value }))}>
            {dayOptions.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </DsSelect>
        </DsField>
        <DsField label="Bắt đầu" htmlFor="sf-start">
          <DsInput id="sf-start" type="time" value={scheduleForm.startTime} required onChange={(event) => setScheduleForm((current) => ({ ...current, startTime: event.target.value }))} />
        </DsField>
        <DsField label="Kết thúc" htmlFor="sf-end">
          <DsInput id="sf-end" type="time" value={scheduleForm.endTime} required onChange={(event) => setScheduleForm((current) => ({ ...current, endTime: event.target.value }))} />
        </DsField>
        <DsField label="Thời lượng khung giờ (phút)" htmlFor="sf-duration">
          <DsInput id="sf-duration" inputMode="numeric" value={scheduleForm.slotDuration} required onChange={(event) => setScheduleForm((current) => ({ ...current, slotDuration: event.target.value.replace(/\D/g, "") }))} />
        </DsField>
        <DsField label="Số người khám tối đa" htmlFor="sf-max">
          <DsInput id="sf-max" inputMode="numeric" value={scheduleForm.maxPatients} required onChange={(event) => setScheduleForm((current) => ({ ...current, maxPatients: event.target.value.replace(/\D/g, "") }))} />
        </DsField>
      </div>
      <label className="ds-check" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={scheduleForm.isActive} onChange={(event) => setScheduleForm((current) => ({ ...current, isActive: event.target.checked }))} style={{ marginTop: 3 }} />
        <span>
          <strong>Đang dùng</strong>
          <small style={{ display: "block", color: "var(--ds-muted)" }}>Lịch mẫu tạm tắt không sinh khung giờ mới.</small>
        </span>
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <DsButton onClick={closePane}>Đóng</DsButton>
        <DsButton type="submit" variant="primary" disabled={saving || (!editing && !scheduleForm.doctorId)}>
          {saving ? "Đang lưu..." : editing ? "Lưu lịch" : "Tạo lịch"}
        </DsButton>
      </div>
    </form>
  );

  let paneNode: React.ReactNode = null;

  if (pane?.kind === "slot" && selectedSlot) {
    const status = effectiveSlotStatus(selectedSlot);
    const past = isVietnamSlotStartInPast(selectedSlot.date, selectedSlot.startTime);
    const editable = canManageSlots && !selectedSlot.appointment && selectedSlot.status !== "BOOKED" && !past;
    paneNode = (
      <DsPane
        title={`${formatVietnamDate(selectedSlot.date)} · ${selectedSlot.startTime} - ${selectedSlot.endTime}`}
        badge={<DsStatusPill tone={status.tone}>{status.label}</DsStatusPill>}
        onClose={closePane}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <DsKeyValue
            items={[
              { label: "Bác sĩ", value: doctorName(selectedSlot.doctor) },
              { label: "Khoa", value: selectedSlot.doctor.department.name },
              { label: "Lịch hẹn", value: selectedSlot.appointment?.bookingCode || "Chưa có" },
              ...(selectedSlot.lockReason ? [{ label: "Lý do khóa", value: selectedSlot.lockReason }] : []),
            ]}
          />
          {status.note ? <DsNotice tone="info">{status.note}</DsNotice> : null}
          {!editable ? (
            <DsNotice tone="info">
              {selectedSlot.appointment || selectedSlot.status === "BOOKED" ? "Khung giờ đã có lịch hẹn nên không thay đổi được ở đây; đổi lịch hoặc hủy từ trang Lịch hẹn." : past ? "Khung giờ đã qua nên không thay đổi được." : "Tài khoản không có quyền thay đổi khung giờ."}
            </DsNotice>
          ) : (
            <>
              {lockOpen ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void lockSlot(selectedSlot);
                  }}
                  style={{ display: "grid", gap: 8 }}
                  aria-label="Khóa khung giờ"
                >
                  <DsField label="Lý do khóa" htmlFor="lock-reason" required hint="Khung giờ chưa có lịch hẹn sẽ tạm ẩn khỏi luồng đặt lịch; có thể mở khóa lại.">
                    <DsTextarea id="lock-reason" rows={3} value={lockReason} placeholder="Ví dụ: bận họp chuyên môn" onChange={(event) => setLockReason(event.target.value.slice(0, 300))} />
                  </DsField>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <DsButton onClick={() => { setLockOpen(false); setLockReason(""); }}>Hủy</DsButton>
                    <DsButton type="submit" variant="primary" disabled={saving || lockReason.trim().length < 2}>
                      {saving ? "Đang khóa..." : "Xác nhận khóa"}
                    </DsButton>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedSlot.status === "LOCKED" ? (
                    <DsButton variant="primary" onClick={() => void unlockSlot(selectedSlot)}>
                      Mở khóa
                    </DsButton>
                  ) : (
                    <DsButton onClick={() => { setLockOpen(true); setLockReason(selectedSlot.lockReason || ""); }}>Khóa khung giờ</DsButton>
                  )}
                  {canWrite && selectedSlot.status !== "AVAILABLE" ? <DsButton onClick={() => void setSlotStatusTo(selectedSlot, "AVAILABLE")}>Đặt lại còn trống</DsButton> : null}
                  {canWrite && selectedSlot.status !== "CANCELLED" ? <DsButton onClick={() => void setSlotStatusTo(selectedSlot, "CANCELLED")}>Huỷ khung giờ</DsButton> : null}
                </div>
              )}
              {canWrite ? (
                confirmDelete ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>Xoá khung giờ này?</span>
                    <DsButton variant="danger" onClick={() => void deleteSlot(selectedSlot)}>
                      Xoá khung giờ
                    </DsButton>
                    <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
                  </div>
                ) : (
                  <div>
                    <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                      Xoá khung giờ
                    </DsButton>
                  </div>
                )
              ) : null}
            </>
          )}
        </div>
      </DsPane>
    );
  } else if (pane?.kind === "schedule" && selectedSchedule) {
    paneNode = (
      <DsPane
        title={`${dayLabel(selectedSchedule.dayOfWeek)} · ${selectedSchedule.startTime} - ${selectedSchedule.endTime}`}
        badge={<DsStatusPill tone={selectedSchedule.isActive ? "good" : "neutral"}>{selectedSchedule.isActive ? "Đang dùng" : "Tạm tắt"}</DsStatusPill>}
        onClose={closePane}
      >
        {canWrite ? (
          <div style={{ display: "grid", gap: 12 }}>
            {scheduleFormFields(true)}
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13 }}>
                  Xoá lịch {doctorName(selectedSchedule.doctor)} · {dayLabel(selectedSchedule.dayOfWeek)}?
                </span>
                <DsButton variant="danger" onClick={() => void deleteSchedule()}>
                  Xoá lịch
                </DsButton>
                <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
              </div>
            ) : (
              <div>
                <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Xoá lịch mẫu
                </DsButton>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <DsKeyValue
              items={[
                { label: "Bác sĩ", value: doctorName(selectedSchedule.doctor) },
                { label: "Thứ", value: dayLabel(selectedSchedule.dayOfWeek) },
                { label: "Giờ", value: `${selectedSchedule.startTime} - ${selectedSchedule.endTime}` },
                { label: "Khung giờ", value: `${selectedSchedule.slotDuration} phút / tối đa ${selectedSchedule.maxPatients}` },
              ]}
            />
            {isDoctor ? (
              <div>
                <DsButton variant="primary" onClick={() => openPane({ kind: "newRequest", scheduleId: selectedSchedule.id })}>
                  Gửi yêu cầu đổi lịch này
                </DsButton>
              </div>
            ) : null}
          </div>
        )}
      </DsPane>
    );
  } else if (pane?.kind === "newSchedule" && canWrite) {
    paneNode = (
      <DsPane title="Tạo lịch mẫu" onClose={closePane}>
        {scheduleFormFields(false)}
      </DsPane>
    );
  } else if (pane?.kind === "generate" && canWrite) {
    const setRangeDays = (days: number) => {
      setGenerateFrom(today());
      setGenerateTo(addDaysToInput(today(), days - 1));
    };
    paneNode = (
      <DsPane title="Sinh khung giờ" onClose={closePane}>
        <form onSubmit={generateSlots} style={{ display: "grid", gap: 12 }} aria-label="Sinh khung giờ theo khoảng ngày">
          <p className="ds-hint" style={{ margin: 0 }}>
            Hệ thống đã tự sinh khung giờ cho 14 ngày tới. Dùng công cụ này khi cần mở xa hơn (tối đa 62 ngày một lần). Không tạo trùng khung giờ có sẵn.
          </p>
          <DsField label="Bác sĩ" htmlFor="gen-doctor" required>
            <DsSelect id="gen-doctor" value={generateDoctorId} required onChange={(event) => setGenerateDoctorId(event.target.value)}>
              <option value="">Chọn bác sĩ</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctorName(doctor)}
                </option>
              ))}
            </DsSelect>
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Từ ngày">
              <VietnamDateInput value={generateFrom} onChange={setGenerateFrom} required ariaLabel="Từ ngày" className="ds-input" />
            </DsField>
            <DsField label="Đến ngày">
              <VietnamDateInput value={generateTo} onChange={setGenerateTo} required ariaLabel="Đến ngày" className="ds-input" />
            </DsField>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[7, 14, 30].map((days) => (
              <DsButton key={days} onClick={() => setRangeDays(days)}>
                {days} ngày tới
              </DsButton>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton type="submit" variant="primary" disabled={saving || !generateDoctorId || !generateFrom || !generateTo}>
              {saving ? "Đang sinh..." : "Sinh khung giờ"}
            </DsButton>
          </div>
        </form>
      </DsPane>
    );
  } else if (pane?.kind === "timeOff" && canLockRange) {
    paneNode = (
      <DsPane title="Nghỉ phép / đóng lịch" onClose={closePane}>
        <div style={{ display: "grid", gap: 12 }}>
          <p className="ds-hint" style={{ margin: 0 }}>
            Đóng mọi khung giờ còn trống của bác sĩ trong khoảng ngày (nghỉ phép, họp, việc đột xuất). Lịch đã đặt không bị hủy: hệ thống liệt kê để nhân viên liên hệ người khám đổi lịch.
          </p>
          {isDoctor ? null : (
            <DsField label="Bác sĩ" htmlFor="off-doctor" required>
              <DsSelect id="off-doctor" value={offDoctorId} onChange={(event) => setOffDoctorId(event.target.value)}>
                <option value="">Chọn bác sĩ</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctorName(doctor)}
                  </option>
                ))}
              </DsSelect>
            </DsField>
          )}
          <div className="ds-grid-fields">
            <DsField label="Từ ngày">
              <VietnamDateInput value={offFrom} onChange={(value) => { setOffFrom(value); if (value > offTo) setOffTo(value); }} required ariaLabel="Nghỉ từ ngày" className="ds-input" />
            </DsField>
            <DsField label="Đến ngày">
              <VietnamDateInput value={offTo} onChange={setOffTo} required ariaLabel="Nghỉ đến ngày" className="ds-input" />
            </DsField>
          </div>
          <DsField label="Lý do" htmlFor="off-reason" hint="Hiện cho nhân viên và nhật ký, ví dụ: Nghỉ phép năm, Họp chuyên môn">
            <DsInput id="off-reason" value={offReason} maxLength={200} onChange={(event) => setOffReason(event.target.value)} />
          </DsField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <DsButton disabled={saving} onClick={() => void runRange("reopen")}>
              Mở lại khoảng này
            </DsButton>
            <DsButton variant="primary" disabled={saving || offReason.trim().length < 2 || !offFrom || !offTo} onClick={() => void runRange("close")}>
              {saving ? "Đang xử lý..." : "Đóng lịch"}
            </DsButton>
          </div>
          {offResult?.affected?.length ? (
            <DsNotice tone="warn">
              <div style={{ display: "grid", gap: 6 }}>
                <strong>{offResult.affected.length} lịch đã đặt cần liên hệ người khám</strong>
                {offResult.affected.slice(0, 10).map((item) => (
                  <span key={item.appointmentId} className="ds-mono">
                    {item.bookingCode} · {item.patientName} · {formatVietnamDate(item.date)} {item.startTime}
                  </span>
                ))}
                {offResult.affected.length > 10 ? <span>Và {offResult.affected.length - 10} lịch khác. Xem đầy đủ ở trang Lịch hẹn.</span> : null}
              </div>
            </DsNotice>
          ) : null}
        </div>
      </DsPane>
    );
  } else if (pane?.kind === "reconcile" && canReconcile) {
    paneNode = (
      <DsPane title="Đối soát khung giờ" onClose={closePane}>
        <div style={{ display: "grid", gap: 12 }}>
          <p className="ds-hint" style={{ margin: 0 }}>
            Phát hiện khung giờ và lịch hẹn lệch trạng thái. Bước kiểm tra chỉ đọc dữ liệu; bước khắc phục chỉ sửa các trường hợp an toàn.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DsButton disabled={Boolean(reconciling)} onClick={() => void reconcileSlots(false)}>
              <ShieldCheck aria-hidden="true" />
              {reconciling === "scan" ? "Đang kiểm tra..." : "Kiểm tra dữ liệu"}
            </DsButton>
            <DsButton variant="primary" disabled={Boolean(reconciling) || !hasRepairable} title={!hasRepairable ? "Chạy kiểm tra trước; chỉ khắc phục khi có sai lệch sửa được" : undefined} onClick={() => void reconcileSlots(true)}>
              <Wrench aria-hidden="true" />
              {reconciling === "repair" ? "Đang khắc phục..." : "Khắc phục an toàn"}
            </DsButton>
          </div>
          {reconciliationResult ? (
            <div className="ds-card">
              <div className="ds-card__body">
                <DsKeyValue
                  items={[
                    { label: "Đã quét", value: reconciliationResult.scanned },
                    { label: "Sai lệch", value: reconciliationResult.findingCount },
                    { label: "Đã sửa", value: reconciliationResult.repairedCount },
                  ]}
                />
              </div>
              {reconciliationResult.findings.slice(0, 8).map((finding) => (
                <div key={`${finding.type}-${finding.slotId}`} className="ds-labrow">
                  <div className="ds-labrow__main">
                    <strong>{reconciliationFindingLabels[finding.type]}</strong>
                    <small>
                      Slot: {finding.slotId}
                      {finding.appointmentId ? ` · Lịch hẹn: ${finding.appointmentId}` : ""}
                    </small>
                  </div>
                  <DsStatusPill tone={finding.repaired ? "good" : finding.type === "APPOINTMENT_SLOT_MISMATCH" ? "bad" : "warn"}>
                    {finding.repaired ? "Đã sửa" : finding.type === "APPOINTMENT_SLOT_MISMATCH" ? "Cần kiểm tra thủ công" : "Chưa sửa"}
                  </DsStatusPill>
                </div>
              ))}
              {reconciliationResult.findings.length > 8 ? <p className="ds-hint" style={{ margin: 0, padding: "10px 14px" }}>Còn {reconciliationResult.findings.length - 8} sai lệch khác trong lượt đối soát này.</p> : null}
              {reconciliationResult.findings.length === 0 ? <p style={{ margin: 0, padding: 14, color: "var(--ds-good)" }}>Dữ liệu khung giờ đang nhất quán.</p> : null}
            </div>
          ) : null}
        </div>
      </DsPane>
    );
  } else if (pane?.kind === "newRequest" && isDoctor) {
    paneNode = (
      <DsPane title="Gửi yêu cầu đổi lịch" onClose={closePane}>
        <ScheduleRequestForm
          schedules={schedules}
          initialScheduleId={pane.scheduleId}
          onSent={() => {
            setNotice("Đã gửi yêu cầu đổi lịch. Bộ phận vận hành sẽ xem và duyệt.");
            setView("requests");
            closePane();
          }}
          onError={setError}
          onCancel={closePane}
        />
      </DsPane>
    );
  } else if (pane?.kind === "request" && selectedRequest) {
    paneNode = (
      <DsPane
        title={isDoctor ? requestTypeLabels[selectedRequest.type] : doctorName(selectedRequest.doctor)}
        badge={<DsStatusPill tone={requestStatusTone[selectedRequest.status]}>{requestStatusLabel[selectedRequest.status]}</DsStatusPill>}
        onClose={closePane}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <DsKeyValue
            items={[
              ...(!isDoctor ? [{ label: "Loại yêu cầu", value: requestTypeLabels[selectedRequest.type] }] : []),
              { label: "Lịch mẫu đề xuất", value: `${dayLabel(selectedRequest.dayOfWeek)} · ${selectedRequest.startTime} - ${selectedRequest.endTime}` },
              { label: "Khung giờ", value: `${selectedRequest.slotDuration} phút / tối đa ${selectedRequest.maxPatients}` },
              { label: "Áp dụng từ", value: formatVietnamDate(selectedRequest.effectiveFrom) },
              { label: "Lý do", value: selectedRequest.reason },
              ...(selectedRequest.reviewerNote ? [{ label: "Phản hồi", value: selectedRequest.reviewerNote }] : []),
            ]}
          />
          {selectedRequest.status === "PENDING" ? (
            isDoctor ? (
              <div>
                <DsButton variant="danger" disabled={saving} onClick={() => void cancelRequest(selectedRequest)}>
                  Hủy yêu cầu
                </DsButton>
              </div>
            ) : canWrite ? (
              rejecting ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <DsField label="Lý do từ chối" htmlFor="reject-note" required>
                    <DsInput id="reject-note" value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value.slice(0, 500))} />
                  </DsField>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <DsButton onClick={() => { setRejecting(false); setReviewerNote(""); }}>Hủy</DsButton>
                    <DsButton variant="danger" disabled={saving || !reviewerNote.trim()} onClick={() => void reviewRequest(selectedRequest, "REJECTED")}>
                      Xác nhận từ chối
                    </DsButton>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <DsButton variant="primary" disabled={saving} onClick={() => void reviewRequest(selectedRequest, "APPROVED")}>
                    Duyệt
                  </DsButton>
                  <DsButton disabled={saving} onClick={() => setRejecting(true)}>
                    Từ chối
                  </DsButton>
                </div>
              )
            ) : null
          ) : null}
          <p className="ds-hint" style={{ margin: 0 }}>
            Duyệt yêu cầu sẽ cập nhật lịch mẫu; khung giờ đã sinh và lịch đã đặt không tự thay đổi.
          </p>
        </div>
      </DsPane>
    );
  }

  return (
    <>
      <DsPageHeader
        title="Lịch bác sĩ"
        description={
          isDoctor
            ? "Theo dõi lịch mẫu, khung giờ của mình và gửi yêu cầu thay đổi để bộ phận vận hành phê duyệt"
            : "Quản lý lịch mẫu theo tuần, tạo khung giờ khám theo ngày và kiểm soát trạng thái từng khung giờ"
        }
        actions={
          <>
            {canWrite ? (
              <DsButton variant="primary" onClick={startNewSchedule}>
                <Plus aria-hidden="true" />
                Tạo lịch mẫu
              </DsButton>
            ) : null}
            {canWrite ? <DsButton onClick={() => openPane({ kind: "generate" })}>Sinh khung giờ</DsButton> : null}
            {canLockRange ? <DsButton onClick={() => { setOffResult(null); openPane({ kind: "timeOff" }); }}>Nghỉ / đóng lịch</DsButton> : null}
            {canReconcile ? <DsButton onClick={() => openPane({ kind: "reconcile" })}>Đối soát</DsButton> : null}
            {isDoctor ? (
              <DsButton
                variant="primary"
                onClick={() => {
                  setView("requests");
                  openPane({ kind: "newRequest" });
                }}
              >
                Gửi yêu cầu đổi lịch
              </DsButton>
            ) : null}
          </>
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
        {view !== "requests" && !pane ? (
          <DsNotice tone="info">Khung giờ 14 ngày tới được hệ thống tự sinh từ lịch mẫu theo tuần. Đổi hoặc tắt lịch mẫu sẽ gỡ các khung giờ còn trống; lịch đã đặt được giữ và báo cho nhân viên xử lý.</DsNotice>
        ) : null}
      </div>
      <DsSplit list={list} pane={paneNode} />
    </>
  );
}

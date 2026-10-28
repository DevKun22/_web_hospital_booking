"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelRightOpen, Plus, ShieldCheck, Wrench, X } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardPageHeader, DashboardStatusBadge } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDashboardDoctorSchedules,
  useDashboardDoctorTimeSlots,
  useDashboardScheduleDoctors,
} from "@/lib/dashboard-schedules-query";
import { formatVietnamDate, getVietnamDateInput, isVietnamSlotStartInPast } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { ScheduleChangeRequestPanel } from "@/components/dashboard/schedule-change-request-panel";
import type {
  DoctorProfile,
  DoctorSchedule,
  DoctorTimeSlot,
  TimeSlotStatus,
} from "@/lib/types";

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
  type:
    | "ORPHAN_BOOKED_SLOT"
    | "LINKED_SLOT_NOT_BOOKED"
    | "TERMINAL_APPOINTMENT_STILL_LINKED"
    | "APPOINTMENT_SLOT_MISMATCH";
  slotId: string;
  appointmentId: string | null;
  repaired: boolean;
};

type SlotReconciliationResult = {
  policy: {
    weeklyScheduleChangesAffect: string;
    bookedSlots: string;
    unsafeMismatchRepair: string;
  };
  scanned: number;
  findingCount: number;
  repairedCount: number;
  findings: SlotReconciliationFinding[];
};

const reconciliationFindingLabels: Record<
  SlotReconciliationFinding["type"],
  string
> = {
  ORPHAN_BOOKED_SLOT: "Khung giờ báo đã đặt nhưng không còn lịch hẹn",
  LINKED_SLOT_NOT_BOOKED: "Khung giờ có lịch hẹn nhưng trạng thái chưa đồng bộ",
  TERMINAL_APPOINTMENT_STILL_LINKED: "Lịch đã kết thúc nhưng vẫn giữ khung giờ",
  APPOINTMENT_SLOT_MISMATCH: "Thông tin lịch hẹn và khung giờ không khớp",
};

const emptyScheduleForm: ScheduleForm = {
  doctorId: "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "11:30",
  slotDuration: "30",
  maxPatients: "1",
  isActive: true,
};

const dayOptions = [
  { value: "0", label: "Chủ nhật" },
  { value: "1", label: "Thứ 2" },
  { value: "2", label: "Thứ 3" },
  { value: "3", label: "Thứ 4" },
  { value: "4", label: "Thứ 5" },
  { value: "5", label: "Thứ 6" },
  { value: "6", label: "Thứ 7" },
];

const slotStatuses: { value: "" | TimeSlotStatus; label: string }[] = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "AVAILABLE", label: "Còn trống" },
  { value: "BOOKED", label: "Đã đặt" },
  { value: "LOCKED", label: "Đã khoá" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

const statusClass: Record<TimeSlotStatus, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-800",
  BOOKED: "bg-sky-50 text-sky-800",
  LOCKED: "bg-amber-50 text-amber-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};

const statusLabel: Record<TimeSlotStatus, string> = {
  AVAILABLE: "Còn trống",
  BOOKED: "Đã đặt",
  LOCKED: "Đã khoá",
  CANCELLED: "Đã huỷ",
};

const effectiveSlotStatus = (slot: DoctorTimeSlot) => {
  if (slot.status === "AVAILABLE" && isVietnamSlotStartInPast(slot.date, slot.startTime)) {
    return {
      label: "Đã qua giờ",
      className: "bg-slate-100 text-slate-700",
      note: "Ẩn trên website người dùng",
    };
  }

  return {
    label: statusLabel[slot.status],
    className: statusClass[slot.status],
    note: "",
  };
};

const today = () => getVietnamDateInput();

const formatDate = (value: string) => formatVietnamDate(value);

const doctorName = (doctor: DoctorSchedule["doctor"] | DoctorProfile) =>
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

const buildCreateSchedulePayload = (form: ScheduleForm) => ({
  doctorId: form.doctorId,
  dayOfWeek: Number(form.dayOfWeek),
  startTime: form.startTime,
  endTime: form.endTime,
  slotDuration: Number(form.slotDuration || 30),
  maxPatients: Number(form.maxPatients || 1),
  isActive: form.isActive,
});

const buildUpdateSchedulePayload = (form: ScheduleForm) => ({
  dayOfWeek: Number(form.dayOfWeek),
  startTime: form.startTime,
  endTime: form.endTime,
  slotDuration: Number(form.slotDuration || 30),
  maxPatients: Number(form.maxPatients || 1),
  isActive: form.isActive,
});

export default function SchedulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [doctorId, setDoctorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [scheduleActive, setScheduleActive] = useState("");
  const [slotDoctorId, setSlotDoctorId] = useState("");
  const [slotDate, setSlotDate] = useState(today());
  const [slotStatus, setSlotStatus] = useState("");
  const [schedulePage, setSchedulePage] = useState(1);
  const [slotPage, setSlotPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<DoctorSchedule | null>(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<DoctorTimeSlot | null>(null);
  const [lockSlotTarget, setLockSlotTarget] = useState<DoctorTimeSlot | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [generateDoctorId, setGenerateDoctorId] = useState("");
  const [generateDate, setGenerateDate] = useState(today());
  const [reconciliationResult, setReconciliationResult] = useState<SlotReconciliationResult | null>(null);
  const [reconciling, setReconciling] = useState<"scan" | "repair" | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);
  const scheduleListRef = useRef<HTMLElement | null>(null);
  const slotListRef = useRef<HTMLElement | null>(null);

  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF";
  const canReconcile = user?.role === "ADMIN";
  const isDoctor = user?.role === "DOCTOR";
  const canManageSlots = canWrite || isDoctor;

  const scheduleQuery = useMemo(
    () => ({
      doctorId: isDoctor ? undefined : doctorId || undefined,
      dayOfWeek: dayOfWeek || undefined,
      isActive: scheduleActive || undefined,
      page: schedulePage,
      limit: 20,
    }),
    [dayOfWeek, doctorId, isDoctor, scheduleActive, schedulePage],
  );

  const slotQuery = useMemo(
    () => ({
      doctorId: isDoctor ? undefined : slotDoctorId || undefined,
      date: slotDate || undefined,
      status: slotStatus || undefined,
      page: slotPage,
      limit: 30,
    }),
    [isDoctor, slotDate, slotDoctorId, slotPage, slotStatus],
  );
  const doctorQuery = useMemo(() => ({ isAvailable: "true", limit: 100 }), []);
  const doctorsQuery = useDashboardScheduleDoctors(doctorQuery, !isDoctor);
  const schedulesQuery = useDashboardDoctorSchedules(scheduleQuery);
  const slotsQuery = useDashboardDoctorTimeSlots(slotQuery);
  const loadingSchedules = schedulesQuery.isLoading;
  const loadingSlots = slotsQuery.isLoading;
  const doctors = doctorsQuery.data?.items ?? [];
  const schedules = schedulesQuery.data?.items ?? [];
  const slots = slotsQuery.data?.items ?? [];
  const schedulePagination = schedulesQuery.data?.pagination ?? { page: schedulePage, limit: 20, total: 0, totalPages: 1 };
  const slotPagination = slotsQuery.data?.pagination ?? { page: slotPage, limit: 30, total: 0, totalPages: 1 };
  const queryError = doctorsQuery.error || schedulesQuery.error || slotsQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu lịch khám"
    : "";
  const visibleError = error || queryErrorMessage;
  const hasRepairableReconciliationFindings = Boolean(
    reconciliationResult?.findings.some(
      (finding) =>
        finding.type !== "APPOINTMENT_SLOT_MISMATCH" && !finding.repaired,
    ),
  );

  const invalidateSchedules = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-schedules"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
  };

  const invalidateSlots = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-time-slots"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "available-slots"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
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

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const setSlotQuickFilter = (status: "" | TimeSlotStatus, date = today()) => {
    setSlotStatus(status);
    setSlotDate(date);
    setSlotPage(1);
    scrollTo(slotListRef);
  };

  const slotSummary = {
    total: slots.length,
    available: slots.filter((slot) => slot.status === "AVAILABLE" && !isVietnamSlotStartInPast(slot.date, slot.startTime)).length,
    booked: slots.filter((slot) => slot.status === "BOOKED").length,
    locked: slots.filter((slot) => slot.status === "LOCKED").length,
  };

  const startCreate = () => {
    setWorkspaceOpen(true);
    setEditingSchedule(null);
    setDeleteScheduleTarget(null);
    setScheduleForm(emptyScheduleForm);
    setError("");
    setNotice("");
    scrollTo(formPanelRef);
  };

  const startEdit = (schedule: DoctorSchedule) => {
    setWorkspaceOpen(true);
    setEditingSchedule(schedule);
    setDeleteScheduleTarget(null);
    setScheduleForm(toScheduleForm(schedule));
    setError("");
    setNotice("");
    scrollTo(formPanelRef);
  };

  const startLockSlot = (slot: DoctorTimeSlot) => {
    setLockSlotTarget(slot);
    setDeleteSlotTarget(null);
    setLockReason(slot.lockReason || "");
    setError("");
    setNotice("");
  };

  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingSchedule) {
        await apiRequest<DoctorSchedule>(`/dashboard/doctor-schedules/${editingSchedule.id}`, {
          method: "PATCH",
          body: buildUpdateSchedulePayload(scheduleForm),
        });
        setNotice("Đã cập nhật lịch làm việc");
      } else {
        await apiRequest<DoctorSchedule>("/dashboard/doctor-schedules", {
          method: "POST",
          body: buildCreateSchedulePayload(scheduleForm),
        });
        setNotice("Đã tạo lịch làm việc");
      }
      setEditingSchedule(null);
      setScheduleForm(emptyScheduleForm);
      await invalidateSchedules();
      scrollTo(scheduleListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được lịch làm việc");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!canWrite || !deleteScheduleTarget) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorSchedule>(`/dashboard/doctor-schedules/${deleteScheduleTarget.id}`, { method: "DELETE" });
      setNotice("Đã xoá lịch làm việc");
      setDeleteScheduleTarget(null);
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được lịch làm việc");
    }
  };

  const handleGenerateSlots = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ items: DoctorTimeSlot[]; generatedCount: number; total: number }>(
        "/dashboard/doctor-time-slots/generate",
        {
          method: "POST",
          body: { doctorId: generateDoctorId, date: generateDate },
        },
      );
      setSlotDoctorId(generateDoctorId);
      setSlotDate(generateDate);
      setSlotPage(1);
      setNotice(`Đã sinh ${result.generatedCount} slot, tổng hiện có ${result.total} slot`);
      await invalidateSlots();
      scrollTo(slotListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được khung giờ");
    } finally {
      setSaving(false);
    }
  };

  const handleSlotStatus = async (slot: DoctorTimeSlot, status: TimeSlotStatus) => {
    if (!canWrite) return;
    const reason = status === "LOCKED" ? lockReason.trim() : null;
    if (status === "LOCKED" && (!reason || reason.length < 2)) {
      setError("Lý do khóa khung giờ cần có ít nhất 2 ký tự");
      return;
    }

    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/status`, {
        method: "PATCH",
        body: { status, lockReason: reason },
      });
      setNotice("Đã cập nhật khung giờ");
      setLockSlotTarget(null);
      setLockReason("");
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được khung giờ");
    }
  };

  const handleLockSlot = async (slot: DoctorTimeSlot) => {
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
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/lock`, {
        method: "PATCH",
        body: { lockReason: reason },
      });
      setNotice("Đã khóa khung giờ khám");
      setLockSlotTarget(null);
      setLockReason("");
      void invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không khóa được khung giờ");
    } finally {
      setSaving(false);
    }
  };
  const handleUnlockSlot = async (slot: DoctorTimeSlot) => {
    if (!canManageSlots) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/unlock`, {
        method: "PATCH",
      });
      setNotice("Đã mở khóa khung giờ");
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở khóa được khung giờ");
    }
  };

  const handleDeleteSlot = async () => {
    if (!canWrite || !deleteSlotTarget) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${deleteSlotTarget.id}`, { method: "DELETE" });
      setNotice("Đã xoá khung giờ");
      setDeleteSlotTarget(null);
      await invalidateSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được khung giờ");
    }
  };

  const handleReconcileSlots = async (repair: boolean) => {
    if (!canReconcile) return;
    setReconciling(repair ? "repair" : "scan");
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<SlotReconciliationResult>(
        "/dashboard/doctor-time-slots/reconcile",
        {
          method: "POST",
          body: { repair, batchSize: 500 },
        },
      );
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

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen && (canWrite || isDoctor) ? "xl:grid-cols-[minmax(0,1fr)_400px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section className="min-w-0 space-y-6">
        <DashboardPageHeader
          eyebrow={isDoctor ? "Lịch làm việc của tôi" : "Điều phối nguồn lực"}
          title="Lịch làm việc bác sĩ"
          description={isDoctor
            ? "Theo dõi lịch mẫu và gửi yêu cầu thay đổi để bộ phận vận hành phê duyệt."
            : "Quản lý lịch mẫu theo tuần, tạo khung giờ khám theo ngày và kiểm soát trạng thái từng khung giờ."}
          actions={(
            <>
              {canWrite ? <Button onClick={startCreate} size="lg"><Plus />Tạo lịch mẫu</Button> : null}
              {!workspaceOpen ? (
                <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}>
                  <PanelRightOpen />
                  {isDoctor ? "Mở yêu cầu đổi lịch" : "Mở công cụ lịch"}
                </Button>
              ) : null}
            </>
          )}
        />
        <section ref={scheduleListRef} className="scroll-mt-24 rounded-md border border-[#dce3ee] bg-white">
          <div className={`grid gap-3 border-b border-[#e5ebf3] p-4 ${isDoctor ? "lg:grid-cols-[160px_160px]" : "lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_160px_160px]"}`}>
            {!isDoctor ? (
              <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setSchedulePage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                <option value="">Tất cả bác sĩ</option>
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
              </select>
            ) : null}
            <select value={dayOfWeek} onChange={(e) => { setDayOfWeek(e.target.value); setSchedulePage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              <option value="">Tất cả thứ</option>
              {dayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
            <select value={scheduleActive} onChange={(e) => { setScheduleActive(e.target.value); setSchedulePage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang dùng</option>
              <option value="false">Tạm tắt</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bác sĩ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Thứ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Giờ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Khung giờ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingSchedules ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Đang tải lịch...</td></tr>
                ) : schedules.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Chưa có lịch mẫu</td></tr>
                ) : schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <p className="font-semibold">{doctorName(schedule.doctor)}</p>
                      <p className="mt-1 text-xs text-[#667892]">{schedule.doctor.department.name}</p>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{dayOptions.find((day) => day.value === String(schedule.dayOfWeek))?.label}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{schedule.startTime} - {schedule.endTime}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{schedule.slotDuration} phút / tối đa {schedule.maxPatients}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <DashboardStatusBadge tone={schedule.isActive ? "positive" : "neutral"}>{schedule.isActive ? "Đang dùng" : "Tạm tắt"}</DashboardStatusBadge>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canWrite ? (
                          <>
                            <button onClick={() => startEdit(schedule)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Sửa</button>
                            <button onClick={() => setDeleteScheduleTarget(schedule)} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Xoá</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deleteScheduleTarget ? (
            <div className="border-t border-[#f2d4d2] bg-[#fff8f7] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#8f1d18]">Xoá lịch làm việc?</p>
                  <p className="mt-1 text-sm text-[#667892]">
                    {doctorName(deleteScheduleTarget.doctor)} - {dayOptions.find((day) => day.value === String(deleteScheduleTarget.dayOfWeek))?.label}, {deleteScheduleTarget.startTime} - {deleteScheduleTarget.endTime}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDeleteScheduleTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Giữ lại</button>
                  <button type="button" onClick={() => void handleDeleteSchedule()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#8f1d18]">Xoá lịch</button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
            <span>{schedulePagination.total} kết quả, trang {schedulePagination.page}/{schedulePagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <button disabled={schedulePage <= 1} onClick={() => setSchedulePage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
              <button disabled={schedulePage >= schedulePagination.totalPages} onClick={() => setSchedulePage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
            </div>
          </div>
        </section>

        <section ref={slotListRef} className="scroll-mt-24 rounded-md border border-[#dce3ee] bg-white">
          <div className="border-b border-[#e5ebf3] p-5">
            <p className="text-sm font-medium text-[#55708f]">{isDoctor ? "Khung giờ khám của tôi" : "Khung giờ khám theo ngày"}</p>
            <h2 className="mt-1 text-2xl font-semibold">Khung giờ khám</h2>
            <p className="mt-2 text-sm text-[#667892]">
              {isDoctor ? "Theo dõi khung giờ của mình; có thể khóa hoặc mở khóa khung giờ chưa đặt và chưa qua giờ." : "Tạo khung giờ từ lịch mẫu; khóa, mở khóa, hủy hoặc xóa khung giờ chưa được đặt."}
            </p>
          </div>
          {isDoctor ? (
            <div className="grid gap-3 border-b border-[#e5ebf3] p-4 sm:grid-cols-2 xl:grid-cols-4">
              <button type="button" onClick={() => setSlotQuickFilter("", today())} className="rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-4 text-left text-[#0d4f8b] transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-sm font-medium opacity-80">Khung giờ đang lọc</p><p className="mt-2 text-2xl font-semibold">{slotSummary.total}</p><p className="mt-1 text-xs opacity-75">Toàn bộ khung giờ trong ngày</p></button>
              <button type="button" onClick={() => setSlotQuickFilter("AVAILABLE", today())} className="rounded-md border border-[#c7ead0] bg-[#f0fff4] p-4 text-left text-[#1f7a3a] transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-sm font-medium opacity-80">Còn trống</p><p className="mt-2 text-2xl font-semibold">{slotSummary.available}</p><p className="mt-1 text-xs opacity-75">Có thể nhận đặt lịch</p></button>
              <button type="button" onClick={() => setSlotQuickFilter("BOOKED", today())} className="rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-4 text-left text-[#0d4f8b] transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-sm font-medium opacity-80">Đã đặt</p><p className="mt-2 text-2xl font-semibold">{slotSummary.booked}</p><p className="mt-1 text-xs opacity-75">Có lịch hẹn liên quan</p></button>
              <button type="button" onClick={() => setSlotQuickFilter("LOCKED", today())} className="rounded-md border border-[#f4d7a1] bg-[#fff8eb] p-4 text-left text-[#946200] transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-sm font-medium opacity-80">Đã khóa</p><p className="mt-2 text-2xl font-semibold">{slotSummary.locked}</p><p className="mt-1 text-xs opacity-75">Không nhận đặt lịch</p></button>
            </div>
          ) : null}
          <div className={`grid gap-3 border-b border-[#e5ebf3] p-4 ${isDoctor ? "lg:grid-cols-[160px_190px]" : "lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_160px_190px]"}`}>
            {!isDoctor ? (
            <select value={slotDoctorId} onChange={(e) => { setSlotDoctorId(e.target.value); setSlotPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              <option value="">Tất cả bác sĩ</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
            </select>
            ) : null}
            <VietnamDateInput value={slotDate} onChange={(value) => { setSlotDate(value); setSlotPage(1); }} ariaLabel="Ngày lọc khung giờ" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
            <select value={slotStatus} onChange={(e) => { setSlotStatus(e.target.value); setSlotPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {slotStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Ngày</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bác sĩ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Giờ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingSlots ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Đang tải khung giờ...</td></tr>
                ) : slots.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Chưa có khung giờ phù hợp</td></tr>
                ) : slots.map((slot) => {
                  const status = effectiveSlotStatus(slot);

                  return (
                    <tr key={slot.id}>
                      <td className="border-b border-[#eef2f7] px-4 py-3">{formatDate(slot.date)}</td>
                      <td className="border-b border-[#eef2f7] px-4 py-3">
                        <p className="font-semibold">{doctorName(slot.doctor)}</p>
                        <p className="mt-1 text-xs text-[#667892]">{slot.doctor.department.name}</p>
                      </td>
                      <td className="border-b border-[#eef2f7] px-4 py-3">{slot.startTime} - {slot.endTime}</td>
                      <td className="border-b border-[#eef2f7] px-4 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                        {status.note ? <p className="mt-1 text-xs text-[#667892]">{status.note}</p> : null}
                        {slot.lockReason ? <p className="mt-1 text-xs text-[#667892]">{slot.lockReason}</p> : null}
                      </td>
                      <td className="border-b border-[#eef2f7] px-4 py-3">{slot.appointment?.bookingCode || "-"}</td>
                      <td className="border-b border-[#eef2f7] px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canManageSlots && !slot.appointment && slot.status !== "BOOKED" && !isVietnamSlotStartInPast(slot.date, slot.startTime) ? (
                            <>
                              {slot.status === "LOCKED" ? (
                                <button onClick={() => void handleUnlockSlot(slot)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Mở khoá</button>
                              ) : (
                                <button onClick={() => startLockSlot(slot)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Khoá</button>
                              )}
                              {canWrite && slot.status !== "CANCELLED" ? <button onClick={() => void handleSlotStatus(slot, "CANCELLED")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Huỷ</button> : null}
                              {canWrite && slot.status !== "AVAILABLE" ? <button onClick={() => void handleSlotStatus(slot, "AVAILABLE")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Trống</button> : null}
                              {canWrite ? <button onClick={() => { setDeleteSlotTarget(slot); setLockSlotTarget(null); }} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Xoá</button> : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {deleteSlotTarget ? (
            <div className="border-t border-[#f2d4d2] bg-[#fff8f7] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#8f1d18]">Xoá khung giờ khám?</p>
                  <p className="mt-1 text-sm text-[#667892]">
                    {formatDate(deleteSlotTarget.date)} - {deleteSlotTarget.startTime} đến {deleteSlotTarget.endTime}, {doctorName(deleteSlotTarget.doctor)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDeleteSlotTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Giữ lại</button>
                  <button type="button" onClick={() => void handleDeleteSlot()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#8f1d18]">Xoá khung giờ</button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
            <span>{slotPagination.total} kết quả, trang {slotPagination.page}/{slotPagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <button disabled={slotPage <= 1} onClick={() => setSlotPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
              <button disabled={slotPage >= slotPagination.totalPages} onClick={() => setSlotPage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
            </div>
          </div>
        </section>
      </section>

      {workspaceOpen && (canWrite || isDoctor) ? (
        <aside className="min-w-0">
          <DashboardWorkspace
            open={workspaceOpen}
            onOpenChange={setWorkspaceOpen}
            title={isDoctor ? "Yêu cầu thay đổi lịch" : "Công cụ lịch bác sĩ"}
            description={isDoctor ? "Gửi và theo dõi yêu cầu điều chỉnh lịch làm việc." : "Tạo lịch mẫu và phát sinh khung giờ khám theo ngày."}
          >
          <div className="space-y-4">
          {canWrite ? <>
          <section ref={formPanelRef} className="scroll-mt-24 rounded-md border border-[#dce3ee] bg-white p-5">
            <h3 className="text-lg font-semibold">{editingSchedule ? "Cập nhật lịch mẫu" : "Tạo lịch mẫu"}</h3>
            <form className="mt-5 space-y-4" onSubmit={handleScheduleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-[#334155]">Bác sĩ</span>
                {editingSchedule ? (
                  <input value={doctorName(editingSchedule.doctor)} disabled className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-[#f6f8fb] px-3 py-2 text-sm text-[#667892]" />
                ) : (
                  <select value={scheduleForm.doctorId} onChange={(e) => setScheduleForm((current) => ({ ...current, doctorId: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required>
                    <option value="">Chọn bác sĩ</option>
                    {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
                  </select>
                )}
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#334155]">Thứ trong tuần</span>
                <select value={scheduleForm.dayOfWeek} onChange={(e) => setScheduleForm((current) => ({ ...current, dayOfWeek: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required>
                  {dayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Bắt đầu</span>
                  <input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((current) => ({ ...current, startTime: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Kết thúc</span>
                  <input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((current) => ({ ...current, endTime: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Thời lượng khung giờ</span>
                  <input value={scheduleForm.slotDuration} onChange={(e) => setScheduleForm((current) => ({ ...current, slotDuration: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Số bệnh nhân tối đa</span>
                  <input value={scheduleForm.maxPatients} onChange={(e) => setScheduleForm((current) => ({ ...current, maxPatients: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2">
                <span className="text-sm font-medium text-[#334155]">Đang dùng</span>
                <input type="checkbox" checked={scheduleForm.isActive} onChange={(e) => setScheduleForm((current) => ({ ...current, isActive: e.target.checked }))} className="h-4 w-4 accent-[#0d4f8b]" />
              </label>
              <div className="flex gap-2">
                <button disabled={saving} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : editingSchedule ? "Lưu lịch" : "Tạo lịch"}</button>
                {editingSchedule ? <button type="button" onClick={startCreate} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b]">Huỷ</button> : null}
              </div>
            </form>
          </section>

          <section className="rounded-md border border-[#dce3ee] bg-white p-5">
            <h3 className="text-lg font-semibold">Tạo khung giờ theo ngày</h3>
            <p className="mt-2 text-sm leading-6 text-[#667892]">Chọn bác sĩ và ngày. Hệ thống sẽ tạo các khung giờ từ lịch mẫu tương ứng với ngày trong tuần.</p>
            <form className="mt-5 space-y-4" onSubmit={handleGenerateSlots}>
              <label className="block">
                <span className="text-sm font-medium text-[#334155]">Bác sĩ</span>
                <select value={generateDoctorId} onChange={(e) => setGenerateDoctorId(e.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required>
                  <option value="">Chọn bác sĩ</option>
                  {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#334155]">Ngày tạo khung giờ</span>
                <VietnamDateInput value={generateDate} onChange={setGenerateDate} required ariaLabel="Ngày tạo khung giờ" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              </label>
              <button disabled={saving} className="w-full rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang tạo..." : "Tạo khung giờ"}</button>
            </form>
          </section>
          {canReconcile ? (
            <section className="rounded-md border border-[#dce3ee] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="rounded-md bg-[#e7f6ed] p-2 text-[#1f7a3a]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">Đối soát khung giờ</h3>
                  <p className="mt-1 text-sm leading-6 text-[#667892]">
                    Phát hiện khung giờ và lịch hẹn lệch trạng thái. Bước kiểm tra chỉ đọc dữ liệu; bước khắc phục chỉ sửa các trường hợp an toàn.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={Boolean(reconciling)}
                  onClick={() => void handleReconcileSlots(false)}
                  className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc] disabled:opacity-60"
                >
                  {reconciling === "scan" ? "Đang kiểm tra..." : "Kiểm tra dữ liệu"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(reconciling) || !hasRepairableReconciliationFindings}
                  onClick={() => void handleReconcileSlots(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1f7a3a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17622e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wrench className="h-4 w-4" />
                  {reconciling === "repair" ? "Đang khắc phục..." : "Khắc phục an toàn"}
                </button>
              </div>
              {reconciliationResult ? (
                <div className="mt-4 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3 text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-xs text-[#667892]">Đã quét</p><p className="mt-1 font-semibold">{reconciliationResult.scanned}</p></div>
                    <div><p className="text-xs text-[#667892]">Sai lệch</p><p className="mt-1 font-semibold text-[#8a5a00]">{reconciliationResult.findingCount}</p></div>
                    <div><p className="text-xs text-[#667892]">Đã sửa</p><p className="mt-1 font-semibold text-[#1f7a3a]">{reconciliationResult.repairedCount}</p></div>
                  </div>
                  {reconciliationResult.findings.length ? (
                    <div className="mt-3 space-y-2 border-t border-[#e5ebf3] pt-3">
                      {reconciliationResult.findings.slice(0, 8).map((finding) => (
                        <div key={`${finding.type}-${finding.slotId}`} className="rounded-md bg-white px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-[#334155]">{reconciliationFindingLabels[finding.type]}</span>
                            <DashboardStatusBadge tone={finding.repaired ? "positive" : finding.type === "APPOINTMENT_SLOT_MISMATCH" ? "danger" : "warning"}>
                              {finding.repaired ? "Đã sửa" : finding.type === "APPOINTMENT_SLOT_MISMATCH" ? "Cần kiểm tra thủ công" : "Chưa sửa"}
                            </DashboardStatusBadge>
                          </div>
                          <p className="mt-1 break-all text-xs text-[#667892]">Slot: {finding.slotId}{finding.appointmentId ? ` · Lịch hẹn: ${finding.appointmentId}` : ""}</p>
                        </div>
                      ))}
                      {reconciliationResult.findings.length > 8 ? <p className="text-xs text-[#667892]">Còn {reconciliationResult.findings.length - 8} sai lệch khác trong lượt đối soát này.</p> : null}
                    </div>
                  ) : (
                    <p className="mt-3 border-t border-[#e5ebf3] pt-3 text-center text-[#1f7a3a]">Dữ liệu khung giờ đang nhất quán.</p>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
          </> : null}
          <ScheduleChangeRequestPanel isDoctor={Boolean(isDoctor)} schedules={schedules} onNotice={setNotice} onError={setError} />
          </div>
          </DashboardWorkspace>
        </aside>
      ) : null}
      {lockSlotTarget ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="lock-slot-title">
          <button type="button" aria-label={"Đóng hộp thoại khóa khung giờ"} onClick={() => { setLockSlotTarget(null); setLockReason(""); }} className="absolute inset-0 cursor-default bg-[#172033]/40" />
          <form className="relative z-10 w-full max-w-lg rounded-md border border-[#dce3ee] bg-white p-5 shadow-2xl" onSubmit={(event) => { event.preventDefault(); void handleLockSlot(lockSlotTarget); }}>
            <div className="flex items-start justify-between gap-4 border-b border-[#e5ebf3] pb-4">
              <div><p className="text-sm font-medium text-[#8a5a00]">{"Điều chỉnh khả dụng"}</p><h3 id="lock-slot-title" className="mt-1 text-xl font-semibold text-[#172033]">{"Khóa khung giờ khám"}</h3></div>
              <button type="button" onClick={() => { setLockSlotTarget(null); setLockReason(""); }} className="rounded-md p-2 text-[#667892] hover:bg-[#f1f5f9] hover:text-[#172033]" aria-label={"Đóng"}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 rounded-md border border-[#f4d7a1] bg-[#fff8eb] p-3 text-sm text-[#6f4b00]"><p className="font-semibold">{formatDate(lockSlotTarget.date)}</p><p className="mt-1">{lockSlotTarget.startTime}{" đến "}{lockSlotTarget.endTime} - {doctorName(lockSlotTarget.doctor)}</p></div>
            <label className="mt-5 block"><span className="text-sm font-medium text-[#334155]">{"Lý do khóa"}</span><textarea autoFocus value={lockReason} onChange={(event) => setLockReason(event.target.value.slice(0, 300))} className="mt-1 min-h-28 w-full resize-y rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" placeholder={"Ví dụ: bận họp chuyên môn"} minLength={2} required /></label>
            <p className="mt-2 text-xs leading-5 text-[#667892]">{"Khung giờ chưa có lịch hẹn sẽ tạm ẩn khỏi luồng đặt lịch. Bạn có thể mở khóa lại khi sẵn sàng nhận lịch."}</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => { setLockSlotTarget(null); setLockReason(""); }} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">{"Hủy"}</button><button disabled={saving} type="submit" className="rounded-md bg-[#8a5a00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6f4b00] disabled:opacity-60">{saving ? "Đang khóa..." : "Xác nhận khóa"}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

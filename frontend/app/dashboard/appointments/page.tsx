"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, PanelRightOpen, RotateCcw, Search, X } from "lucide-react";
import { DashboardEmptyState, DashboardPageHeader, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import {
  AppointmentStatusBadge,
  appointmentStatusOptions,
} from "@/features/appointments/appointment-status";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardAppointmentDoctors, useDashboardAppointments, useDashboardPendingInvoiceAppointments } from "@/lib/dashboard-appointments-query";
import { formatVietnamDate, getVietnamDateInput, getVietnamYesterdayDateInput } from "@/lib/date";
import { usePublicAvailableSlots } from "@/lib/public-booking-query";
import { queryKeys } from "@/lib/query-keys";
import type { Appointment, AppointmentStatus, DoctorProfile } from "@/lib/types";

const today = () => getVietnamDateInput();

const formatDate = (value: string) => formatVietnamDate(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const doctorName = (doctor: DoctorProfile | Appointment["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const isCancelled = (status: AppointmentStatus) => status.startsWith("CANCELLED");

type PatientInfoForm = {
  patientName: string;
  patientEmail: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  cccd: string;
  address: string;
  hasBHYT: boolean;
  healthInsuranceCode: string;
  registeredHospital: string;
  allergies: string;
  medicalHistory: string;
  familyHistory: string;
};

const emptyPatientInfoForm: PatientInfoForm = {
  patientName: "",
  patientEmail: "",
  gender: "",
  dateOfBirth: "",
  cccd: "",
  address: "",
  hasBHYT: false,
  healthInsuranceCode: "",
  registeredHospital: "",
  allergies: "",
  medicalHistory: "",
  familyHistory: "",
};

const toDateInputValue = (value: string | null) => (value ? value.slice(0, 10) : "");

const buildPatientInfoForm = (appointment: Appointment): PatientInfoForm => ({
  patientName: appointment.patientName,
  patientEmail: appointment.patientEmail || "",
  gender: appointment.patientGender || "",
  dateOfBirth: toDateInputValue(appointment.patientDateOfBirth),
  cccd: appointment.patientCccd || "",
  address: appointment.patientAddress || "",
  hasBHYT: appointment.hasBHYT,
  healthInsuranceCode: appointment.healthInsuranceCode || "",
  registeredHospital: appointment.registeredHospital || "",
  allergies: appointment.allergies || "",
  medicalHistory: appointment.medicalHistory || "",
  familyHistory: appointment.familyHistory || "",
});

const canEditPatientInfoStatus = (status: AppointmentStatus) =>
  ["PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status);

export default function AppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(today());
  const [phone, setPhone] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [billingState, setBillingState] = useState<"" | "PENDING_INVOICE" | "HAS_INVOICE">("");
  const [appliedPhone, setAppliedPhone] = useState("");
  const [appliedBookingCode, setAppliedBookingCode] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSnapshot, setSelected] = useState<Appointment | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(today());
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [editingPatientInfo, setEditingPatientInfo] = useState(false);
  const [patientInfoForm, setPatientInfoForm] = useState<PatientInfoForm>(emptyPatientInfoForm);
  const listRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const canStaffActions = user?.role === "ADMIN" || user?.role === "STAFF";
  const isDoctor = user?.role === "DOCTOR";

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      date: date || undefined,
      phone: appliedPhone || undefined,
      bookingCode: appliedBookingCode || undefined,
      billingState: canStaffActions ? billingState || undefined : undefined,
      page,
      limit: 20,
    }),
    [appliedBookingCode, appliedPhone, billingState, canStaffActions, date, doctorId, isDoctor, page, status],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const appointmentsQuery = useDashboardAppointments(query);
  const pendingInvoiceQuery = useDashboardPendingInvoiceAppointments(canStaffActions);
  const doctorsQuery = useDashboardAppointmentDoctors(doctorQuery, !isDoctor);
  const rescheduleSlotsQuery = usePublicAvailableSlots({
    doctorId: rescheduleTarget?.doctor.id,
    date: rescheduleTarget ? rescheduleDate : undefined,
  });
  const loading = appointmentsQuery.isLoading;
  const appointments = appointmentsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pendingInvoiceCount = pendingInvoiceQuery.data?.pagination.total ?? 0;
  const selected = selectedSnapshot
    ? appointments.find((appointment) => appointment.id === selectedSnapshot.id) ?? selectedSnapshot
    : null;
  const canEditSelectedPatientInfo =
    canStaffActions &&
    Boolean(selected) &&
    !selected?.invoice &&
    Boolean(selected && canEditPatientInfoStatus(selected.status));
  const pagination = appointmentsQuery.data?.pagination ?? {
    page,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
  const queryError = appointmentsQuery.error || doctorsQuery.error || pendingInvoiceQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu lịch hẹn"
    : "";
  const visibleError = error || queryErrorMessage;

  const invalidateAppointments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-time-slots"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "invoices"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
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

  const setQuickFilter = (nextStatus: "" | AppointmentStatus, nextDate = today()) => {
    setStatus(nextStatus);
    setBillingState("");
    setDate(nextDate);
    setPhone("");
    setBookingCode("");
    setAppliedPhone("");
    setAppliedBookingCode("");
    setPage(1);
    scrollTo(listRef);
  };

  const openPendingInvoiceQueue = () => {
    setStatus("COMPLETED");
    setBillingState("PENDING_INVOICE");
    setDoctorId("");
    setDate("");
    setPhone("");
    setBookingCode("");
    setAppliedPhone("");
    setAppliedBookingCode("");
    setPage(1);
    scrollTo(listRef);
  };

  const doctorSummary = {
    total: appointments.length,
    waiting: appointments.filter((item) => item.status === "CHECKED_IN").length,
    inProgress: appointments.filter((item) => item.status === "IN_PROGRESS").length,
    completed: appointments.filter((item) => item.status === "COMPLETED").length,
  };

  const applySearchFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedPhone(phone.trim());
    setAppliedBookingCode(bookingCode.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setStatus("");
    setDoctorId("");
    setDate(today());
    setPhone("");
    setBookingCode("");
    setBillingState("");
    setAppliedPhone("");
    setAppliedBookingCode("");
    setPage(1);
  };

  const runAction = async (appointment: Appointment, path: string, message: string, body?: unknown) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Appointment>(`/dashboard/appointments/${appointment.id}${path}`, {
        method: "PATCH",
        body,
      });
      setSelected(updated);
      setNotice(message);
      await invalidateAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  };

  const openPatientInfoEditor = (appointment: Appointment) => {
    setSelected(appointment);
    setWorkspaceOpen(true);
    setPatientInfoForm(buildPatientInfoForm(appointment));
    setEditingPatientInfo(true);
    setCancelTarget(null);
    setCancelReason("");
    setError("");
    setNotice("");
    scrollTo(detailRef);
  };

  const updatePatientInfoField = <K extends keyof PatientInfoForm>(key: K, value: PatientInfoForm[K]) => {
    setPatientInfoForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "hasBHYT" && value === false) {
        next.healthInsuranceCode = "";
        next.registeredHospital = "";
      }
      return next;
    });
  };

  const updatePatientInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !canEditSelectedPatientInfo) return;
    if (patientInfoForm.hasBHYT && !patientInfoForm.healthInsuranceCode.trim()) {
      setError("Vui lòng nhập mã thẻ BHYT");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Appointment>(`/dashboard/appointments/${selected.id}/patient-info`, {
        method: "PATCH",
        body: {
          patientName: patientInfoForm.patientName.trim(),
          patientEmail: patientInfoForm.patientEmail.trim() || null,
          gender: patientInfoForm.gender || null,
          dateOfBirth: patientInfoForm.dateOfBirth || null,
          cccd: patientInfoForm.cccd.trim() || null,
          address: patientInfoForm.address.trim() || null,
          hasBHYT: patientInfoForm.hasBHYT,
          healthInsuranceCode: patientInfoForm.hasBHYT ? patientInfoForm.healthInsuranceCode.trim() : null,
          registeredHospital: patientInfoForm.hasBHYT ? patientInfoForm.registeredHospital.trim() || null : null,
          allergies: patientInfoForm.allergies.trim() || null,
          medicalHistory: patientInfoForm.medicalHistory.trim() || null,
          familyHistory: patientInfoForm.familyHistory.trim() || null,
        },
      });
      setSelected(updated);
      setPatientInfoForm(buildPatientInfoForm(updated));
      setEditingPatientInfo(false);
      setNotice("Đã cập nhật thông tin tiếp nhận");
      await invalidateAppointments();
      scrollTo(detailRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được thông tin tiếp nhận");
    } finally {
      setBusy(false);
    }
  };

  const startCancelAppointment = (appointment: Appointment) => {
    setSelected(appointment);
    setWorkspaceOpen(true);
    setEditingPatientInfo(false);
    setCancelTarget(appointment);
    setRescheduleTarget(null);
    setCancelReason("");
    setError("");
    setNotice("");
    scrollTo(detailRef);
  };

  const startRescheduleAppointment = (appointment: Appointment) => {
    setSelected(appointment);
    setWorkspaceOpen(true);
    setEditingPatientInfo(false);
    setCancelTarget(null);
    setCancelReason("");
    setRescheduleTarget(appointment);
    setRescheduleDate(appointment.appointmentDate.slice(0, 10));
    setRescheduleSlotId("");
    setRescheduleReason("");
    setError("");
    setNotice("");
    scrollTo(detailRef);
  };

  const rescheduleAppointment = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleSlotId) {
      setError("Vui lòng chọn khung giờ mới");
      return;
    }
    if (rescheduleReason.trim().length < 2) {
      setError("Vui lòng nhập lý do đổi lịch");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Appointment>(
        `/dashboard/appointments/${rescheduleTarget.id}/reschedule`,
        {
          method: "PATCH",
          body: {
            timeSlotId: rescheduleSlotId,
            reason: rescheduleReason.trim(),
          },
        },
      );
      setSelected(updated);
      setPatientInfoForm(buildPatientInfoForm(updated));
      setRescheduleTarget(null);
      setRescheduleSlotId("");
      setRescheduleReason("");
      setNotice(`Đã đổi lịch sang ${formatDate(updated.appointmentDate)} lúc ${updated.startTime}`);
      await Promise.all([
        invalidateAppointments(),
        queryClient.invalidateQueries({ queryKey: ["public", "available-slots"] }),
      ]);
      scrollTo(detailRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được lịch hẹn");
      await rescheduleSlotsQuery.refetch();
    } finally {
      setBusy(false);
    }
  };

  const cancelAppointment = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 2) {
      setError("Vui lòng nhập lý do hủy lịch");
      return;
    }
    await runAction(cancelTarget, "/cancel", "Đã hủy lịch hẹn", { reason: cancelReason.trim() });
    setCancelTarget(null);
    setCancelReason("");
  };

  const cleanupExpiredOtp = async () => {
    if (!canStaffActions) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ expiredBefore: string; count: number }>(
        "/dashboard/appointments/cleanup-expired-otp",
        { method: "POST" },
      );
      setNotice(`Đã dọn ${result.count} lịch quá hạn xác thực`);
      await invalidateAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không dọn được lịch quá hạn xác thực");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (appointment: Appointment) => {
    setSelected(appointment);
    setWorkspaceOpen(true);
    setPatientInfoForm(buildPatientInfoForm(appointment));
    setEditingPatientInfo(false);
    setCancelTarget(null);
    setCancelReason("");
    setRescheduleTarget(null);
    setRescheduleSlotId("");
    setRescheduleReason("");
    scrollTo(detailRef);
  };

  const renderActions = (appointment: Appointment) => {
    if (busy || isCancelled(appointment.status)) return null;

    return (
      <>
        {canStaffActions && appointment.status === "PENDING_CONFIRM" ? (
          <button onClick={() => void runAction(appointment, "/confirm", "Đã xác nhận lịch")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Xác nhận</button>
        ) : null}
        {canStaffActions && appointment.status === "CONFIRMED" ? (
          <button onClick={() => void runAction(appointment, "/check-in", "Đã tiếp nhận bệnh nhân")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Tiếp nhận</button>
        ) : null}
        {canStaffActions && appointment.status === "CONFIRMED" ? (
          <button onClick={() => startRescheduleAppointment(appointment)} className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b]">Đổi lịch</button>
        ) : null}
        {appointment.status === "CHECKED_IN" ? (
          <button onClick={() => void runAction(appointment, "/start", "Đã bắt đầu khám")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Bắt đầu</button>
        ) : null}
        {appointment.status === "IN_PROGRESS" ? (
          <button onClick={() => void runAction(appointment, "/complete", "Đã hoàn thành")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Hoàn thành</button>
        ) : null}
        {["IN_PROGRESS", "COMPLETED"].includes(appointment.status) ? (
          <Link href="/dashboard/medical-records" className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b]">Hồ sơ</Link>
        ) : null}
        {canStaffActions && appointment.status === "COMPLETED" ? (
          <Link
            href={appointment.invoice ? `/dashboard/invoices?invoiceCode=${appointment.invoice.invoiceCode}` : `/dashboard/invoices?appointment=${appointment.bookingCode}`}
            className="rounded-md border border-[#bde5c8] px-3 py-1.5 text-xs font-medium text-[#1f7a3a]"
          >
            {appointment.invoice ? "Hóa đơn" : "Tạo hóa đơn"}
          </Link>
        ) : null}
        {canStaffActions && ["CONFIRMED", "CHECKED_IN"].includes(appointment.status) ? (
          <button onClick={() => void runAction(appointment, "/no-show", "Đã đánh dấu bệnh nhân vắng mặt")} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Vắng mặt</button>
        ) : null}
        {appointment.status !== "PENDING_OTP" && appointment.status !== "COMPLETED" ? (
          <button onClick={() => startCancelAppointment(appointment)} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Hủy</button>
        ) : null}
      </>
    );
  };

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_400px]" : "xl:grid-cols-1"}`}>
      {notice || visibleError ? (
        <div className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-md sm:right-6 sm:top-6">
          <Alert
            variant={visibleError ? "destructive" : "default"}
            role={visibleError ? "alert" : "status"}
            aria-live={visibleError ? "assertive" : "polite"}
            className="bg-card px-4 py-3 shadow-lg"
          >
            <AlertTitle>{visibleError ? "Có lỗi xảy ra" : "Thao tác thành công"}</AlertTitle>
            <AlertDescription>{visibleError || notice}</AlertDescription>
            <AlertAction>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setError(""); setNotice(""); }} aria-label="Đóng thông báo">
                <X />
              </Button>
            </AlertAction>
          </Alert>
        </div>
      ) : null}

      <section ref={listRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader
          eyebrow={isDoctor ? "Khu làm việc bác sĩ" : "Vận hành khám bệnh"}
          title="Lịch hẹn"
          description={isDoctor
            ? "Theo dõi hàng đợi hôm nay, tiếp nhận bệnh nhân và chuyển nhanh sang hồ sơ khám."
            : "Tìm kiếm, tiếp nhận và điều phối lịch hẹn theo một quy trình thống nhất."}
          actions={(
            <>
              {selected && !workspaceOpen ? (
                <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}>
                  <PanelRightOpen />
                  Mở chi tiết
                </Button>
              ) : null}
              {canStaffActions ? (
                <Button disabled={busy} variant="outline" size="lg" onClick={() => void cleanupExpiredOtp()}>
                  <RotateCcw />
                  Dọn lịch quá hạn xác thực
                </Button>
              ) : null}
            </>
          )}
        />

        {isDoctor ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setQuickFilter("", today())} className="rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-4 text-left text-[#0d4f8b] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Lịch đang lọc</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.total}</p>
              <p className="mt-1 text-xs opacity-75">Xem toàn bộ lịch trong ngày</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("CHECKED_IN", today())} className="rounded-md border border-[#f4d7a1] bg-[#fff8eb] p-4 text-left text-[#946200] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Đã tiếp nhận</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.waiting}</p>
              <p className="mt-1 text-xs opacity-75">Ưu tiên bắt đầu khám</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("IN_PROGRESS", today())} className="rounded-md border border-[#e2d6ff] bg-[#f7f2ff] p-4 text-left text-[#673ab7] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Đang khám</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.inProgress}</p>
              <p className="mt-1 text-xs opacity-75">Mở hồ sơ hoặc hoàn tất</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("COMPLETED", today())} className="rounded-md border border-[#c7ead0] bg-[#f0fff4] p-4 text-left text-[#1f7a3a] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Hoàn tất</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.completed}</p>
              <p className="mt-1 text-xs opacity-75">Đối soát cuối ca</p>
            </button>
          </div>
        ) : null}

        {canStaffActions ? (
          <DashboardSurface className="overflow-hidden border-amber-200 bg-amber-50/70">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-semibold text-amber-800">
                  {pendingInvoiceQuery.isLoading ? "…" : pendingInvoiceCount}
                </div>
                <div>
                  <h3 className="font-semibold text-amber-950">Chờ lập hóa đơn</h3>
                  <p className="mt-1 text-sm leading-6 text-amber-900/75">
                    Lịch đã hoàn tất khám nhưng chưa phát hành hóa đơn. Hãy kiểm tra thông tin tiếp nhận và quyền lợi BHYT trước khi lập hóa đơn.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="lg" onClick={openPendingInvoiceQueue} className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                Mở hàng đợi
              </Button>
            </div>
          </DashboardSurface>
        ) : null}

        <DashboardSurface>
          <form onSubmit={applySearchFilters} className="border-b border-border p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Bộ lọc lịch hẹn</h3>
                <p className="mt-1 text-sm text-muted-foreground">Ngày và trạng thái cập nhật tức thời; số điện thoại và mã lịch chỉ tìm khi gửi biểu mẫu.</p>
              </div>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <RotateCcw />
                Đặt lại
              </Button>
            </div>
            <div className={`grid gap-3 ${isDoctor ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"}`}>
              <label className="grid gap-1.5 text-sm font-medium">
                Ngày khám
                <VietnamDateInput value={date} onChange={(value) => { setDate(value); setPage(1); }} ariaLabel="Ngày lọc lịch hẹn" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
              </label>
              {!isDoctor ? (
                <label className="grid gap-1.5 text-sm font-medium">
                  Bác sĩ
                  <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                    <option value="">Tất cả bác sĩ</option>
                    {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium">
                Trạng thái
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                  {appointmentStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              {!isDoctor ? (
                <label className="grid gap-1.5 text-sm font-medium">
                  Tình trạng hóa đơn
                  <select value={billingState} onChange={(event) => { setBillingState(event.target.value as typeof billingState); setPage(1); }} className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50">
                    <option value="">Tất cả</option>
                    <option value="PENDING_INVOICE">Chờ lập hóa đơn</option>
                    <option value="HAS_INVOICE">Đã có hóa đơn</option>
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium">
                Số điện thoại
                <Input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="Ví dụ: 0912..." />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Mã lịch
                <Input value={bookingCode} onChange={(event) => setBookingCode(event.target.value)} placeholder="Ví dụ: HB-8492" />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button type="submit" size="lg">
                <Search />
                Tìm lịch hẹn
              </Button>
            </div>
          </form>

          {loading ? (
            <div className="grid gap-3 p-4" aria-label="Đang tải lịch hẹn">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
            </div>
          ) : appointments.length === 0 ? (
            <div className="p-4 sm:p-6">
              <DashboardEmptyState title="Chưa có lịch hẹn phù hợp" description="Thử thay đổi ngày, trạng thái hoặc đặt lại bộ lọc." />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      {['Mã lịch', 'Bệnh nhân', 'Thời gian', 'Bác sĩ / dịch vụ', 'Trạng thái'].map((label) => (
                        <th key={label} className="border-b border-border px-4 py-3 font-semibold">{label}</th>
                      ))}
                      <th className="border-b border-border px-4 py-3 text-right font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment.id} className={`align-top transition-colors ${selected?.id === appointment.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                        <td className="border-b border-border px-4 py-4">
                          <button onClick={() => openDetail(appointment)} className="font-semibold text-primary hover:underline">{appointment.bookingCode}</button>
                          <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(appointment.finalAmount)}</p>
                        </td>
                        <td className="border-b border-border px-4 py-4">
                          <p className="font-semibold">{appointment.patientName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{appointment.patientPhone}</p>
                        </td>
                        <td className="border-b border-border px-4 py-4">
                          {formatDate(appointment.appointmentDate)}
                          <p className="mt-1 text-xs text-muted-foreground">{appointment.startTime} - {appointment.endTime}</p>
                        </td>
                        <td className="max-w-56 border-b border-border px-4 py-4">
                          <p className="font-medium">{doctorName(appointment.doctor)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{appointment.package?.name || appointment.department.name}</p>
                        </td>
                        <td className="border-b border-border px-4 py-4"><AppointmentStatusBadge status={appointment.status} /></td>
                        <td className="border-b border-border px-4 py-4">
                          <div className="flex max-w-72 flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openDetail(appointment)}>Chi tiết</Button>
                            {renderActions(appointment)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-3 lg:hidden">
                {appointments.map((appointment) => (
                  <article key={appointment.id} className={`rounded-xl border bg-card p-4 shadow-xs transition-colors ${selected?.id === appointment.id ? "border-primary/40 bg-primary/[0.03]" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button onClick={() => openDetail(appointment)} className="font-semibold text-primary hover:underline">{appointment.bookingCode}</button>
                        <h3 className="mt-1 truncate font-semibold">{appointment.patientName}</h3>
                        <p className="text-sm text-muted-foreground">{appointment.patientPhone}</p>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                    <div className="mt-4 grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" />{formatDate(appointment.appointmentDate)}, {appointment.startTime} - {appointment.endTime}</p>
                      <p className="truncate font-medium">{doctorName(appointment.doctor)}</p>
                      <p className="truncate text-muted-foreground">{appointment.package?.name || appointment.department.name}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(appointment)}>Chi tiết</Button>
                      {renderActions(appointment)}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{pagination.total} kết quả · Trang {pagination.page}/{pagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                <ChevronLeft /> Trước
              </Button>
              <Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
                Sau <ChevronRight />
              </Button>
            </div>
          </div>
        </DashboardSurface>
      </section>

      {workspaceOpen ? (
        <section ref={detailRef} className="min-w-0 scroll-mt-24">
          <DashboardWorkspace
            open={workspaceOpen}
            onOpenChange={setWorkspaceOpen}
            title={selected ? `Lịch hẹn ${selected.bookingCode}` : "Chi tiết lịch hẹn"}
            description="Thông tin bệnh nhân, dịch vụ và các thao tác phù hợp với trạng thái hiện tại."
          >
        {selected ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-[#55708f]">Chi tiết lịch hẹn</p>
              <h3 className="mt-1 text-xl font-semibold">{selected.bookingCode}</h3>
              <AppointmentStatusBadge status={selected.status} className="mt-3" />
            </div>
            <div className="space-y-3 text-sm">
              <div><p className="text-[#667892]">Bệnh nhân</p><p className="font-semibold">{selected.patientName}</p><p>{selected.patientPhone}</p><p>{selected.patientEmail || "-"}</p></div>
              <div><p className="text-[#667892]">Thời gian</p><p className="font-semibold">{formatDate(selected.appointmentDate)} - {selected.startTime} đến {selected.endTime}</p></div>
              <div><p className="text-[#667892]">Bác sĩ</p><p className="font-semibold">{doctorName(selected.doctor)}</p><p>{selected.department.name}</p></div>
              <div><p className="text-[#667892]">Dịch vụ</p><p className="font-semibold">{selected.package?.name || "Khám bác sĩ"}</p><p>{selected.reason || "Không có lý do khám"}</p></div>
              <div><p className="text-[#667892]">Thành tiền</p><p className="font-semibold">{formatCurrency(selected.finalAmount)}</p><p className="text-xs text-[#667892]">Giá {formatCurrency(selected.estimatedPrice)} + phí {formatCurrency(selected.serviceFee)} - BHYT {formatCurrency(selected.bhytDiscount)}</p></div>
              <div><p className="text-[#667892]">BHYT</p><p>{selected.hasBHYT ? selected.healthInsuranceCode || "Có BHYT" : "Không"}</p></div>
              <div><p className="text-[#667892]">Ghi chú sức khỏe</p><p>Dị ứng: {selected.allergies || "-"}</p><p>Tiền sử: {selected.medicalHistory || "-"}</p><p>Gia đình: {selected.familyHistory || "-"}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-[#e5ebf3] pt-4">
              {canEditSelectedPatientInfo ? (
                <button type="button" onClick={() => openPatientInfoEditor(selected)} className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b]">Cập nhật tiếp nhận</button>
              ) : null}
              {renderActions(selected)}
            </div>
            {editingPatientInfo && canEditSelectedPatientInfo ? (
              <form onSubmit={updatePatientInfo} className="rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
                <div>
                  <h4 className="font-semibold">Thông tin tiếp nhận</h4>
                  <p className="mt-1 text-xs text-[#667892]">Dùng để xác minh thông tin bệnh nhân và BHYT trước khi phát hành hóa đơn.</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-[#334155]">Họ tên bệnh nhân</span>
                    <input value={patientInfoForm.patientName} onChange={(event) => updatePatientInfoField("patientName", event.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#334155]">Email</span>
                    <input type="email" value={patientInfoForm.patientEmail} onChange={(event) => updatePatientInfoField("patientEmail", event.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#334155]">Giới tính</span>
                    <select value={patientInfoForm.gender} onChange={(event) => updatePatientInfoField("gender", event.target.value as PatientInfoForm["gender"])} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                      <option value="">Chưa cập nhật</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#334155]">Ngày sinh</span>
                    <VietnamDateInput value={patientInfoForm.dateOfBirth} max={getVietnamYesterdayDateInput()} onChange={(value) => updatePatientInfoField("dateOfBirth", value)} ariaLabel="Ngày sinh bệnh nhân" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                  <label className="block">
                        <span className="text-xs font-medium text-[#334155]">Căn cước công dân</span>
                    <input value={patientInfoForm.cccd} onChange={(event) => updatePatientInfoField("cccd", event.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-[#334155]">Địa chỉ</span>
                    <input value={patientInfoForm.address} onChange={(event) => updatePatientInfoField("address", event.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                </div>
                <div className="mt-4 rounded-md border border-[#e5ebf3] bg-white p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold text-[#1f2937]">Bệnh nhân có BHYT</span>
                      <span className="text-xs text-[#667892]">Tắt mục này sẽ đặt giảm trừ BHYT về 0.</span>
                    </span>
                    <input type="checkbox" checked={patientInfoForm.hasBHYT} onChange={(event) => updatePatientInfoField("hasBHYT", event.target.checked)} className="h-4 w-4 accent-[#0d4f8b]" />
                  </label>
                  {patientInfoForm.hasBHYT ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-[#334155]">Mã thẻ BHYT</span>
                        <input value={patientInfoForm.healthInsuranceCode} onChange={(event) => updatePatientInfoField("healthInsuranceCode", event.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#334155]">Nơi đăng ký khám chữa bệnh</span>
                        <input value={patientInfoForm.registeredHospital} onChange={(event) => updatePatientInfoField("registeredHospital", event.target.value)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      </label>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-[#334155]">Dị ứng</span>
                    <textarea value={patientInfoForm.allergies} onChange={(event) => updatePatientInfoField("allergies", event.target.value)} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#334155]">Tiền sử bệnh</span>
                    <textarea value={patientInfoForm.medicalHistory} onChange={(event) => updatePatientInfoField("medicalHistory", event.target.value)} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#334155]">Tiền sử gia đình</span>
                    <textarea value={patientInfoForm.familyHistory} onChange={(event) => updatePatientInfoField("familyHistory", event.target.value)} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button disabled={busy} className="rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Đang lưu..." : "Lưu thông tin"}</button>
                  <button type="button" onClick={() => { setEditingPatientInfo(false); setPatientInfoForm(buildPatientInfoForm(selected)); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Đóng</button>
                </div>
              </form>
            ) : null}
            {rescheduleTarget?.id === selected.id ? (
              <div className="rounded-md border border-[#cfe4fa] bg-[#f4f9ff] p-4">
                <div>
                  <h4 className="font-semibold text-[#0d4f8b]">Đổi lịch hẹn</h4>
                  <p className="mt-1 text-xs leading-5 text-[#55708f]">
                    Giữ nguyên bác sĩ và thông tin khám; hệ thống sẽ phát hành mã lịch mới, giải phóng khung giờ cũ và gửi thông báo cho bệnh nhân.
                  </p>
                </div>
                <label className="mt-3 block">
                  <span className="text-sm font-medium text-[#334155]">Ngày khám mới</span>
                  <VietnamDateInput
                    value={rescheduleDate}
                    min={today()}
                    onChange={(value) => {
                      setRescheduleDate(value);
                      setRescheduleSlotId("");
                    }}
                    className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"
                    required
                  />
                </label>
                <div className="mt-3">
                  <p className="text-sm font-medium text-[#334155]">Khung giờ còn trống</p>
                  {rescheduleSlotsQuery.isLoading || rescheduleSlotsQuery.isFetching ? (
                    <p className="mt-2 text-sm text-[#667892]">Đang cập nhật khung giờ...</p>
                  ) : rescheduleSlotsQuery.isError ? (
                    <button type="button" onClick={() => void rescheduleSlotsQuery.refetch()} className="mt-2 text-sm font-medium text-[#b3261e] hover:underline">Không tải được khung giờ. Thử lại</button>
                  ) : (rescheduleSlotsQuery.data?.length || 0) === 0 ? (
                    <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-[#667892]">Bác sĩ chưa còn khung giờ trống trong ngày này.</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {rescheduleSlotsQuery.data?.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setRescheduleSlotId(slot.id)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${rescheduleSlotId === slot.id ? "border-[#0d4f8b] bg-[#0d4f8b] text-white" : "border-[#cfd8e6] bg-white text-[#42526b] hover:border-[#0d4f8b]"}`}
                        >
                          {slot.startTime} - {slot.endTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="mt-3 block">
                  <span className="text-sm font-medium text-[#334155]">Lý do đổi lịch</span>
                  <textarea
                    value={rescheduleReason}
                    onChange={(event) => setRescheduleReason(event.target.value)}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"
                    placeholder="Ví dụ: bác sĩ thay đổi lịch làm việc"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button disabled={busy || !rescheduleSlotId} onClick={() => void rescheduleAppointment()} className="rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Đang đổi lịch..." : "Xác nhận đổi lịch"}</button>
                  <button type="button" onClick={() => { setRescheduleTarget(null); setRescheduleSlotId(""); setRescheduleReason(""); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Đóng</button>
                </div>
              </div>
            ) : null}
            {cancelTarget?.id === selected.id ? (
              <div className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4">
                <h4 className="font-semibold text-[#b3261e]">Xác nhận hủy lịch</h4>
                <label className="mt-3 block">
                  <span className="text-sm font-medium text-[#5f2630]">Lý do hủy</span>
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-[#f2b8b5] bg-white px-3 py-2 text-sm outline-none focus:border-[#b3261e] focus:ring-2 focus:ring-[#f7d0ce]"
                    placeholder="Ví dụ: bệnh nhân yêu cầu hủy lịch"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button disabled={busy} onClick={() => void cancelAppointment()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xác nhận hủy</button>
                  <button type="button" onClick={() => { setCancelTarget(null); setCancelReason(""); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Giữ lịch</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-[#55708f]">Chi tiết lịch hẹn</p>
            <h3 className="mt-1 text-xl font-semibold">Chọn một lịch hẹn</h3>
            <p className="mt-2 text-sm leading-6 text-[#667892]">Bấm vào mã lịch hoặc nút chi tiết để xem thông tin bệnh nhân, giá tiền và thao tác phù hợp.</p>
          </div>
        )}
          </DashboardWorkspace>
        </section>
      ) : null}
    </div>
  );
}

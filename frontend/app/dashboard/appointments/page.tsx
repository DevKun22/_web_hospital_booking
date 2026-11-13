"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { appointmentStatusLabel, appointmentStatusTone } from "@/lib/appointment-status";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDashboardAppointmentDoctors,
  useDashboardAppointments,
  useDashboardPendingInvoiceAppointments,
} from "@/lib/dashboard-appointments-query";
import { formatVietnamDate, getVietnamDateInput, getVietnamYesterdayDateInput } from "@/lib/date";
import { can } from "@/lib/permissions";
import { usePublicAvailableSlots } from "@/lib/public-slots-query";
import { queryKeys } from "@/lib/query-keys";
import type { Appointment, AppointmentStatus, DoctorProfile } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Lịch hẹn: danh sách bên trái; chọn một lịch thì danh sách thu hẹp và khung bên phải gom thông tin người khám,
// thanh toán và các thao tác (xác nhận, tiếp nhận, đổi lịch, hủy, cập nhật thông tin tiếp nhận).

const today = () => getVietnamDateInput();

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

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

// Các trạng thái hiếm gặp gom vào một ô chọn để dãy tab gọn.
const otherStatuses: { value: AppointmentStatus; label: string }[] = [
  { value: "PENDING_OTP", label: "Chờ mã xác thực" },
  { value: "RESCHEDULED", label: "Đã đổi lịch" },
  { value: "NO_SHOW", label: "Không đến" },
  { value: "CANCELLED_BY_PATIENT", label: "Người khám hủy" },
  { value: "CANCELLED_BY_DOCTOR", label: "Bác sĩ hủy" },
  { value: "CANCELLED_BY_ADMIN", label: "Quản trị hủy" },
];

const mainStatusTabs = [
  { id: "all", label: "Tất cả" },
  { id: "PENDING_CONFIRM", label: "Chờ xác nhận" },
  { id: "CONFIRMED", label: "Đã xác nhận" },
  { id: "CHECKED_IN", label: "Đã tiếp nhận" },
  { id: "IN_PROGRESS", label: "Đang khám" },
  { id: "COMPLETED", label: "Hoàn thành" },
];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(today());
  const [search, setSearch] = useState("");
  const [billingState, setBillingState] = useState<"" | "PENDING_INVOICE" | "HAS_INVOICE">("");
  const [page, setPage] = useState(1);
  // Khi khung chi tiết đang mở, cột danh sách hẹp nên chỉ giữ ô tìm; các bộ lọc khác gập sau nút "Bộ lọc".
  const [showFilters, setShowFilters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSnapshot, setSelected] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(today());
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [editingPatientInfo, setEditingPatientInfo] = useState(false);
  const [patientInfoForm, setPatientInfoForm] = useState<PatientInfoForm>(emptyPatientInfoForm);

  const canStaffActions = can(user, "appointment.front_desk");
  const isDoctor = user?.role === "DOCTOR";

  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const term = useDebouncedValue(search.trim());

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      date: date || undefined,
      q: term || undefined,
      billingState: canStaffActions ? billingState || undefined : undefined,
      page,
      limit: 20,
    }),
    [billingState, canStaffActions, date, doctorId, isDoctor, page, status, term],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const appointmentsQuery = useDashboardAppointments(query);
  const pendingInvoiceQuery = useDashboardPendingInvoiceAppointments(canStaffActions);
  const doctorsQuery = useDashboardAppointmentDoctors(doctorQuery, !isDoctor && can(user, "catalog.view"));
  const rescheduleSlotsQuery = usePublicAvailableSlots({
    doctorId: rescheduleTarget?.doctor.id,
    date: rescheduleTarget ? rescheduleDate : undefined,
  });
  const loading = appointmentsQuery.isLoading;
  const appointments = appointmentsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pendingInvoiceCount = pendingInvoiceQuery.data?.pagination.total ?? 0;
  const selected = selectedSnapshot ? appointments.find((appointment) => appointment.id === selectedSnapshot.id) ?? selectedSnapshot : null;
  const canEditSelectedPatientInfo =
    canStaffActions && Boolean(selected) && !selected?.invoice && Boolean(selected && canEditPatientInfoStatus(selected.status));
  const pagination = appointmentsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const queryError = appointmentsQuery.error || doctorsQuery.error || pendingInvoiceQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu lịch hẹn") : "";
  const visibleError = error || queryErrorMessage;

  const invalidateAppointments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-time-slots"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "invoices"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
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
    setEditingPatientInfo(false);
    setCancelTarget(null);
    setCancelReason("");
    setRescheduleTarget(null);
    setRescheduleSlotId("");
    setRescheduleReason("");
  };

  const openDetail = (appointment: Appointment) => {
    setSelected(appointment);
    setPatientInfoForm(buildPatientInfoForm(appointment));
    resetEditors();
    setError("");
    setNotice("");
  };

  const closeDetail = () => {
    setSelected(null);
    resetEditors();
  };

  const resetFilters = () => {
    setStatus("");
    setDoctorId("");
    setDate(today());
    setSearch("");
    setBillingState("");
    setPage(1);
  };

  const runAction = async (appointment: Appointment, path: string, message: string, body?: unknown) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Appointment>(`/dashboard/appointments/${appointment.id}${path}`, { method: "PATCH", body });
      setSelected(updated);
      setNotice(message);
      await invalidateAppointments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startPatientInfoEdit = (appointment: Appointment) => {
    setPatientInfoForm(buildPatientInfoForm(appointment));
    setCancelTarget(null);
    setRescheduleTarget(null);
    setEditingPatientInfo(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được thông tin tiếp nhận");
    } finally {
      setBusy(false);
    }
  };

  const startCancel = (appointment: Appointment) => {
    setEditingPatientInfo(false);
    setRescheduleTarget(null);
    setCancelTarget(appointment);
    setCancelReason("");
    setError("");
  };

  const startReschedule = (appointment: Appointment) => {
    setEditingPatientInfo(false);
    setCancelTarget(null);
    setRescheduleTarget(appointment);
    setRescheduleDate(appointment.appointmentDate.slice(0, 10));
    setRescheduleSlotId("");
    setRescheduleReason("");
    setError("");
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
      const updated = await apiRequest<Appointment>(`/dashboard/appointments/${rescheduleTarget.id}/reschedule`, {
        method: "PATCH",
        body: { timeSlotId: rescheduleSlotId, reason: rescheduleReason.trim() },
      });
      setSelected(updated);
      setPatientInfoForm(buildPatientInfoForm(updated));
      setRescheduleTarget(null);
      setRescheduleSlotId("");
      setRescheduleReason("");
      setNotice(`Đã đổi lịch sang ${formatVietnamDate(updated.appointmentDate)} lúc ${updated.startTime}`);
      await Promise.all([invalidateAppointments(), queryClient.invalidateQueries({ queryKey: ["public", "available-slots"] })]);
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
    const ok = await runAction(cancelTarget, "/cancel", "Đã hủy lịch hẹn", { reason: cancelReason.trim() });
    if (ok) {
      setCancelTarget(null);
      setCancelReason("");
    }
  };

  // Bước tiếp theo của quy trình ứng với trạng thái hiện tại (hiện cả ở dòng danh sách lẫn trong khung chi tiết).
  const nextStep = (appointment: Appointment) => {
    if (canStaffActions && appointment.status === "PENDING_CONFIRM") return { label: "Xác nhận", path: "/confirm", message: "Đã xác nhận lịch" };
    if (canStaffActions && appointment.status === "CONFIRMED") return { label: "Tiếp nhận", path: "/check-in", message: "Đã tiếp nhận người khám" };
    if (appointment.status === "CHECKED_IN") return { label: "Bắt đầu khám", path: "/start", message: "Đã bắt đầu khám" };
    if (appointment.status === "IN_PROGRESS") return { label: "Hoàn thành", path: "/complete", message: "Đã hoàn thành" };
    return null;
  };

  const invoiceHref = (appointment: Appointment) =>
    appointment.invoice
      ? `/dashboard/invoices?invoiceCode=${appointment.invoice.invoiceCode}`
      : `/dashboard/invoices?appointment=${appointment.bookingCode}`;

  // Tab đang chọn: "Chờ lập hóa đơn" là một chế độ lọc riêng (hoàn thành + chưa có hóa đơn, mọi ngày).
  const tabValue = billingState === "PENDING_INVOICE" ? "billing" : status === "" ? "all" : status;
  const tabs = [
    ...mainStatusTabs,
    ...(canStaffActions ? [{ id: "billing", label: "Chờ lập hóa đơn", count: pendingInvoiceCount }] : []),
  ];
  const changeTab = (id: string) => {
    setPage(1);
    if (id === "billing") {
      setStatus("COMPLETED");
      setBillingState("PENDING_INVOICE");
      setDoctorId("");
      setDate("");
      return;
    }
    setBillingState("");
    setStatus(id === "all" ? "" : id);
  };

  const columns: DsColumn<Appointment>[] = [
    {
      key: "time",
      header: "Thời gian",
      cell: (row) => (
        <div>
          <strong>{formatVietnamDate(row.appointmentDate)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.startTime} - {row.endTime}
          </div>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Người khám",
      cell: (row) => (
        <div>
          <strong>{row.patientName}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.patientPhone} · <span className="ds-mono">{row.bookingCode}</span>
          </div>
        </div>
      ),
    },
    {
      key: "doctor",
      header: "Bác sĩ / dịch vụ",
      cell: (row) => (
        <div>
          <span>{doctorName(row.doctor)}</span>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.package?.name || row.department.name}</div>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={appointmentStatusTone(row.status)}>{appointmentStatusLabel[row.status]}</DsStatusPill> },
    {
      key: "action",
      header: "Bước tiếp",
      align: "num",
      cell: (row) => {
        const step = nextStep(row);
        if (step) {
          return (
            <DsButton
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                void runAction(row, step.path, step.message);
              }}
            >
              {step.label}
            </DsButton>
          );
        }
        if (canStaffActions && row.status === "COMPLETED") {
          return (
            <Link href={invoiceHref(row)} className="ds-btn" onClick={(event) => event.stopPropagation()}>
              {row.invoice ? "Hóa đơn" : "Tạo hóa đơn"}
            </Link>
          );
        }
        return null;
      },
    },
  ];

  const open = Boolean(selected);

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc lịch hẹn">
        <DsToolbar>
          <div style={{ minWidth: 170, flex: "1 1 200px", order: -2 }}>
            <DsInput
              aria-label="Tìm lịch hẹn"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ SĐT, mã lịch hoặc tên để lọc"
            />
          </div>
          {open ? (
            <DsButton variant="ghost" aria-expanded={showFilters} style={{ order: -1 }} onClick={() => setShowFilters((current) => !current)}>
              Bộ lọc
            </DsButton>
          ) : null}
          {!open || showFilters ? (
            <>
          <div style={{ minWidth: 150, flex: "0 1 170px" }}>
            <VietnamDateInput
              value={date}
              onChange={(value) => {
                setDate(value);
                setPage(1);
              }}
              ariaLabel="Ngày lọc lịch hẹn"
              className="ds-input"
            />
          </div>
          <DsButton
            variant="ghost"
            onClick={() => {
              setDate(today());
              setPage(1);
            }}
          >
            Hôm nay
          </DsButton>
          {date ? (
            <DsButton
              variant="ghost"
              onClick={() => {
                setDate("");
                setPage(1);
              }}
            >
              Mọi ngày
            </DsButton>
          ) : null}
          {!isDoctor ? (
            <div style={{ minWidth: 160, flex: "1 1 180px" }}>
              <DsSelect
                aria-label="Lọc theo bác sĩ"
                value={doctorId}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả bác sĩ</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctorName(doctor)}
                  </option>
                ))}
              </DsSelect>
            </div>
          ) : null}
          <div style={{ minWidth: 150, flex: "0 1 170px" }}>
            <DsSelect
              aria-label="Trạng thái khác"
              value={otherStatuses.some((item) => item.value === status) ? status : ""}
              onChange={(event) => {
                setBillingState("");
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Trạng thái khác</option>
              {otherStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </DsSelect>
          </div>
          <DsButton variant="ghost" onClick={resetFilters}>
            Đặt lại
          </DsButton>
            </>
          ) : null}
        </DsToolbar>
      </form>
      <DsTabs label="Lọc lịch hẹn theo trạng thái" items={tabs} value={tabValue} onChange={changeTab} />
      {open ? (
        appointments.length ? (
          <div role="listbox" aria-label="Danh sách lịch hẹn">
            {appointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                role="option"
                className="ds-listrow"
                aria-selected={appointment.id === selected?.id}
                onClick={() => openDetail(appointment)}
              >
                <span className="ds-listrow__main">
                  <strong>{appointment.patientName}</strong>
                  <small>
                    {formatVietnamDate(appointment.appointmentDate)} {appointment.startTime} · {doctorName(appointment.doctor)}
                  </small>
                </span>
                <DsStatusPill tone={appointmentStatusTone(appointment.status)}>{appointmentStatusLabel[appointment.status]}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có lịch hẹn phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách lịch hẹn"
          columns={columns}
          rows={appointments}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="Chưa có lịch hẹn phù hợp"
          emptyDescription="Thử đổi ngày, trạng thái hoặc đặt lại bộ lọc."
          onRowClick={openDetail}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} lịch · trang {pagination.page}/{pagination.totalPages || 1}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <DsButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Trước
          </DsButton>
          <DsButton disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
            Sau
          </DsButton>
        </span>
      </div>
    </DsPanel>
  );

  const pane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.bookingCode} · ${selected.patientName}`}
      badge={<DsStatusPill tone={appointmentStatusTone(selected.status)}>{appointmentStatusLabel[selected.status]}</DsStatusPill>}
      onClose={closeDetail}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {formatVietnamDate(selected.appointmentDate)} · {selected.startTime} - {selected.endTime} · {doctorName(selected.doctor)} · {selected.department.name} ·{" "}
        {selected.package?.name || "Khám bác sĩ"}
      </div>

      {!isCancelled(selected.status) ? (
        <div className="ds-savebar" style={{ borderTop: 0, position: "static", paddingTop: 12 }}>
          {(() => {
            const step = nextStep(selected);
            return step ? (
              <DsButton variant="primary" disabled={busy} onClick={() => void runAction(selected, step.path, step.message)}>
                {step.label}
              </DsButton>
            ) : null;
          })()}
          {canStaffActions && selected.status === "COMPLETED" ? (
            <Link href={invoiceHref(selected)} className="ds-btn">
              {selected.invoice ? "Mở hóa đơn" : "Tạo hóa đơn"}
            </Link>
          ) : null}
          {["IN_PROGRESS", "COMPLETED"].includes(selected.status) ? (
            <Link href={`/dashboard/medical-records?recordCode=${encodeURIComponent(selected.bookingCode)}`} className="ds-btn">
              Hồ sơ khám
            </Link>
          ) : null}
          {canStaffActions && selected.status === "CONFIRMED" ? (
            <DsButton disabled={busy} onClick={() => startReschedule(selected)}>
              Đổi lịch
            </DsButton>
          ) : null}
          {canStaffActions && ["CONFIRMED", "CHECKED_IN"].includes(selected.status) ? (
            <DsButton disabled={busy} onClick={() => void runAction(selected, "/no-show", "Đã đánh dấu người khám vắng mặt")}>
              Vắng mặt
            </DsButton>
          ) : null}
          <span style={{ flex: 1 }} />
          {selected.status !== "PENDING_OTP" && selected.status !== "COMPLETED" ? (
            <DsButton variant="ghost" disabled={busy} onClick={() => startCancel(selected)}>
              Hủy lịch
            </DsButton>
          ) : null}
        </div>
      ) : null}

      <div className="ds-editor">
        <div className="ds-editor__col">
          {cancelTarget?.id === selected.id ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Xác nhận hủy lịch</h3>
              </div>
              <div className="ds-card__body">
                <DsField label="Lý do hủy" htmlFor="cancel-reason" required>
                  <DsTextarea id="cancel-reason" rows={3} value={cancelReason} placeholder="Ví dụ: người khám yêu cầu hủy lịch" onChange={(event) => setCancelReason(event.target.value)} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => { setCancelTarget(null); setCancelReason(""); }}>Giữ lịch</DsButton>
                  <DsButton variant="danger" disabled={busy || cancelReason.trim().length < 2} onClick={() => void cancelAppointment()}>
                    Xác nhận hủy
                  </DsButton>
                </div>
              </div>
            </div>
          ) : null}

          {rescheduleTarget?.id === selected.id ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Đổi lịch hẹn</h3>
              </div>
              <div className="ds-card__body">
                <p className="ds-hint" style={{ margin: 0 }}>
                  Giữ nguyên bác sĩ và thông tin khám; hệ thống phát hành mã lịch mới, giải phóng khung giờ cũ và gửi thông báo cho người khám.
                </p>
                <DsField label="Ngày khám mới" htmlFor="reschedule-date">
                  <VietnamDateInput
                    value={rescheduleDate}
                    min={today()}
                    ariaLabel="Ngày khám mới"
                    onChange={(value) => {
                      setRescheduleDate(value);
                      setRescheduleSlotId("");
                    }}
                    className="ds-input"
                    required
                  />
                </DsField>
                <div>
                  <strong style={{ fontSize: 13 }}>Khung giờ còn trống</strong>
                  {rescheduleSlotsQuery.isLoading || rescheduleSlotsQuery.isFetching ? (
                    <p className="ds-hint">Đang cập nhật khung giờ...</p>
                  ) : rescheduleSlotsQuery.isError ? (
                    <p>
                      <DsButton onClick={() => void rescheduleSlotsQuery.refetch()}>Không tải được khung giờ. Thử lại</DsButton>
                    </p>
                  ) : (rescheduleSlotsQuery.data?.length || 0) === 0 ? (
                    <p className="ds-hint">Bác sĩ chưa còn khung giờ trống trong ngày này.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginTop: 8 }}>
                      {rescheduleSlotsQuery.data?.map((slot) => (
                        <DsButton key={slot.id} variant={rescheduleSlotId === slot.id ? "primary" : "default"} aria-pressed={rescheduleSlotId === slot.id} onClick={() => setRescheduleSlotId(slot.id)}>
                          {slot.startTime} - {slot.endTime}
                        </DsButton>
                      ))}
                    </div>
                  )}
                </div>
                <DsField label="Lý do đổi lịch" htmlFor="reschedule-reason" required>
                  <DsTextarea id="reschedule-reason" rows={2} value={rescheduleReason} placeholder="Ví dụ: bác sĩ thay đổi lịch làm việc" onChange={(event) => setRescheduleReason(event.target.value)} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => { setRescheduleTarget(null); setRescheduleSlotId(""); setRescheduleReason(""); }}>Đóng</DsButton>
                  <DsButton
                    variant="primary"
                    disabled={busy || !rescheduleSlotId || rescheduleReason.trim().length < 2}
                    title={!rescheduleSlotId ? "Chọn khung giờ mới" : rescheduleReason.trim().length < 2 ? "Nhập lý do đổi lịch" : undefined}
                    onClick={() => void rescheduleAppointment()}
                  >
                    {busy ? "Đang đổi lịch..." : "Xác nhận đổi lịch"}
                  </DsButton>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Người khám</h3>
              {canEditSelectedPatientInfo && !editingPatientInfo ? <DsButton onClick={() => startPatientInfoEdit(selected)}>Cập nhật tiếp nhận</DsButton> : null}
            </div>
            <div className="ds-card__body">
              <DsKeyValue
                items={[
                  { label: "Họ tên", value: selected.patientName },
                  { label: "Điện thoại", value: selected.patientPhone },
                  { label: "Email", value: selected.patientEmail || "-" },
                  { label: "BHYT", value: selected.hasBHYT ? selected.healthInsuranceCode || "Có BHYT" : "Không" },
                  { label: "Lý do khám", value: selected.reason || "Không có lý do khám" },
                ]}
              />
              <DsKeyValue
                items={[
                  { label: "Dị ứng", value: selected.allergies || "-" },
                  { label: "Tiền sử", value: selected.medicalHistory || "-" },
                  { label: "Gia đình", value: selected.familyHistory || "-" },
                ]}
              />
            </div>
          </div>

          {editingPatientInfo && canEditSelectedPatientInfo ? (
            <form className="ds-card" onSubmit={updatePatientInfo} aria-label="Thông tin tiếp nhận">
              <div className="ds-card__head">
                <h3>Thông tin tiếp nhận</h3>
              </div>
              <div className="ds-card__body">
                <p className="ds-hint" style={{ margin: 0 }}>
                  Dùng để xác minh thông tin người khám và BHYT trước khi phát hành hóa đơn.
                </p>
                <DsField label="Họ tên người khám" htmlFor="pi-name" required>
                  <DsInput id="pi-name" value={patientInfoForm.patientName} required onChange={(event) => updatePatientInfoField("patientName", event.target.value)} />
                </DsField>
                <div className="ds-grid-fields">
                  <DsField label="Email" htmlFor="pi-email">
                    <DsInput id="pi-email" type="email" value={patientInfoForm.patientEmail} onChange={(event) => updatePatientInfoField("patientEmail", event.target.value)} />
                  </DsField>
                  <DsField label="Giới tính" htmlFor="pi-gender">
                    <DsSelect id="pi-gender" value={patientInfoForm.gender} onChange={(event) => updatePatientInfoField("gender", event.target.value as PatientInfoForm["gender"])}>
                      <option value="">Chưa cập nhật</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </DsSelect>
                  </DsField>
                  <DsField label="Ngày sinh" htmlFor="pi-dob">
                    <VietnamDateInput value={patientInfoForm.dateOfBirth} max={getVietnamYesterdayDateInput()} ariaLabel="Ngày sinh người khám" onChange={(value) => updatePatientInfoField("dateOfBirth", value)} className="ds-input" />
                  </DsField>
                  <DsField label="Căn cước công dân" htmlFor="pi-cccd">
                    <DsInput id="pi-cccd" value={patientInfoForm.cccd} onChange={(event) => updatePatientInfoField("cccd", event.target.value)} />
                  </DsField>
                </div>
                <DsField label="Địa chỉ" htmlFor="pi-address">
                  <DsInput id="pi-address" value={patientInfoForm.address} onChange={(event) => updatePatientInfoField("address", event.target.value)} />
                </DsField>
                <label className="ds-check" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={patientInfoForm.hasBHYT} onChange={(event) => updatePatientInfoField("hasBHYT", event.target.checked)} style={{ marginTop: 3 }} />
                  <span>
                    <strong>Người khám có BHYT</strong>
                    <small style={{ display: "block", color: "var(--ds-muted)" }}>Tắt mục này sẽ đặt giảm trừ BHYT về 0.</small>
                  </span>
                </label>
                {patientInfoForm.hasBHYT ? (
                  <div className="ds-grid-fields">
                    <DsField label="Mã thẻ BHYT" htmlFor="pi-bhyt" required>
                      <DsInput id="pi-bhyt" value={patientInfoForm.healthInsuranceCode} required onChange={(event) => updatePatientInfoField("healthInsuranceCode", event.target.value)} />
                    </DsField>
                    <DsField label="Nơi đăng ký khám chữa bệnh" htmlFor="pi-hospital">
                      <DsInput id="pi-hospital" value={patientInfoForm.registeredHospital} onChange={(event) => updatePatientInfoField("registeredHospital", event.target.value)} />
                    </DsField>
                  </div>
                ) : null}
                <DsField label="Dị ứng" htmlFor="pi-allergies">
                  <DsTextarea id="pi-allergies" rows={2} value={patientInfoForm.allergies} onChange={(event) => updatePatientInfoField("allergies", event.target.value)} />
                </DsField>
                <DsField label="Tiền sử bệnh" htmlFor="pi-history">
                  <DsTextarea id="pi-history" rows={2} value={patientInfoForm.medicalHistory} onChange={(event) => updatePatientInfoField("medicalHistory", event.target.value)} />
                </DsField>
                <DsField label="Tiền sử gia đình" htmlFor="pi-family">
                  <DsTextarea id="pi-family" rows={2} value={patientInfoForm.familyHistory} onChange={(event) => updatePatientInfoField("familyHistory", event.target.value)} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => { setEditingPatientInfo(false); setPatientInfoForm(buildPatientInfoForm(selected)); }}>Đóng</DsButton>
                  <DsButton type="submit" variant="primary" disabled={busy}>
                    {busy ? "Đang lưu..." : "Lưu thông tin"}
                  </DsButton>
                </div>
              </div>
            </form>
          ) : null}
        </div>

        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Thanh toán</h3>
              {selected.invoice ? <DsStatusPill tone="good">Đã có hóa đơn</DsStatusPill> : null}
            </div>
            <div className="ds-card__body">
              <DsKeyValue
                items={[
                  { label: "Giá dịch vụ", value: formatCurrency(selected.estimatedPrice) },
                  { label: "Phí dịch vụ", value: formatCurrency(selected.serviceFee) },
                  { label: "Giảm trừ BHYT", value: `- ${formatCurrency(selected.bhytDiscount)}` },
                  { label: "Thành tiền", value: <strong>{formatCurrency(selected.finalAmount)}</strong> },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Lịch hẹn"
        description={
          isDoctor
            ? "Theo dõi hàng đợi, tiếp nhận người khám và chuyển nhanh sang hồ sơ khám"
            : "Tìm kiếm, tiếp nhận và điều phối lịch hẹn theo một quy trình thống nhất"
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit wide list={list} pane={pane} />
    </>
  );
}

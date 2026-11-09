"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsKeyValue,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSplit,
  DsStatusPill,
  DsStepList,
  DsTabs,
  type DsColumn,
} from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDoctorDashboardOverview } from "@/lib/dashboard-overview-query";
import { formatVietnamDate, getVietnamDateInput } from "@/lib/date";
import { can } from "@/lib/permissions";
import { appointmentStatusLabel as statusLabel, appointmentStatusTone as statusTone } from "@/lib/appointment-status";
import type { Appointment, AppointmentStatus } from "@/lib/types";

// Trang chủ của bác sĩ: việc cần làm trước, lịch hôm nay sau; bấm một ca để xem chi tiết ngay cạnh danh sách.

const waitingStatuses: AppointmentStatus[] = ["CONFIRMED", "CHECKED_IN"];

type TabId = "all" | "waiting" | "progress" | "done";

const slotLabel: Record<string, string> = {
  AVAILABLE: "Trống",
  BOOKED: "Đã đặt",
  LOCKED: "Khóa",
  CANCELLED: "Hủy",
};

export function DoctorHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = useMemo(() => getVietnamDateInput(), []);
  const result = useDoctorDashboardOverview(today, true);
  const data = result.data ?? null;

  const [tab, setTab] = useState<TabId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const appointments = useMemo(() => data?.todayAppointments ?? [], [data]);
  const waiting = appointments.filter((item) => waitingStatuses.includes(item.status));
  const inProgress = appointments.filter((item) => item.status === "IN_PROGRESS");
  const done = appointments.filter((item) => item.status === "COMPLETED");

  const visible = useMemo(() => {
    if (tab === "waiting") return waiting;
    if (tab === "progress") return inProgress;
    if (tab === "done") return done;
    return appointments;
  }, [tab, appointments, waiting, inProgress, done]);

  const selected = appointments.find((item) => item.id === selectedId) ?? null;
  const draftRecords = data?.draftRecords ?? [];
  const draftPrescriptions = data?.draftPrescriptions ?? [];

  const slotSummary = (data?.todaySlots ?? []).reduce<Record<string, number>>((summary, slot) => {
    summary[slot.status] = (summary[slot.status] || 0) + 1;
    return summary;
  }, {});
  const slotText = ["AVAILABLE", "BOOKED", "LOCKED"]
    .filter((key) => (slotSummary[key] || 0) > 0)
    .map((key) => `${slotSummary[key]} ${slotLabel[key].toLowerCase()}`)
    .join(" · ");

  const todos = [
    ...inProgress.slice(0, 3).map((item) => ({
      id: `progress-${item.id}`,
      title: `${item.patientName} đang khám`,
      caption: `${item.bookingCode} · ${item.startTime} – ${item.endTime}`,
      warn: false,
      appointmentId: item.id,
      href: "/dashboard/medical-records",
      action: "Mở hồ sơ",
    })),
    ...waiting
      .filter((item) => item.status === "CHECKED_IN")
      .slice(0, 3)
      .map((item) => ({
        id: `checked-${item.id}`,
        title: `${item.patientName} đã check-in`,
        caption: `${item.bookingCode} · ${item.startTime} – ${item.endTime}`,
        warn: true,
        appointmentId: item.id,
        href: "",
        action: "Xem ca",
      })),
    ...draftRecords.slice(0, 3).map((item) => ({
      id: `record-${item.id}`,
      title: `Hồ sơ ${item.recordCode} còn nháp`,
      caption: `${item.patient.fullName} · ${formatVietnamDate(item.appointment.appointmentDate)}`,
      warn: true,
      appointmentId: "",
      href: "/dashboard/medical-records",
      action: "Hoàn thiện",
    })),
    ...draftPrescriptions.slice(0, 2).map((item) => ({
      id: `prescription-${item.id}`,
      title: `Đơn thuốc ${item.prescriptionCode} còn nháp`,
      caption: `${item.patient.fullName} · ${item.items.length} thuốc`,
      warn: true,
      appointmentId: "",
      href: "/dashboard/prescriptions",
      action: "Mở đơn",
    })),
  ].slice(0, 6);

  const runExamAction = async (appointment: Appointment, path: "/start" | "/complete", message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<Appointment>(`/dashboard/appointments/${appointment.id}${path}`, { method: "PATCH" });
      setNotice(message);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  };

  const columns: DsColumn<Appointment>[] = [
    { key: "time", header: "Giờ", cell: (row) => row.startTime, mono: true, width: "72px" },
    {
      key: "patient",
      header: "Người khám",
      cell: (row) => (
        <div>
          <strong>{row.patientName}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.bookingCode}</div>
        </div>
      ),
    },
    { key: "reason", header: "Lý do khám", cell: (row) => row.reason || "Khám bác sĩ" },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => <DsStatusPill tone={statusTone(row.status)}>{statusLabel[row.status]}</DsStatusPill>,
    },
  ];

  const tabs = [
    { id: "all", label: "Tất cả", count: appointments.length },
    { id: "waiting", label: "Chờ khám", count: waiting.length },
    { id: "progress", label: "Đang khám", count: inProgress.length },
    { id: "done", label: "Hoàn tất", count: done.length },
  ];

  const recordFor = (appointment: Appointment) => draftRecords.find((item) => item.appointment.bookingCode === appointment.bookingCode);
  const prescriptionFor = (appointment: Appointment) =>
    draftPrescriptions.find((item) => item.appointment.bookingCode === appointment.bookingCode);

  const pane = selected ? (
    <DsPane
      title={`${selected.patientName} · ${selected.startTime} – ${selected.endTime}`}
      badge={<DsStatusPill tone={statusTone(selected.status)}>{statusLabel[selected.status]}</DsStatusPill>}
      onClose={() => setSelectedId(null)}
      footer={
        <>
          {selected.status === "CHECKED_IN" && can(user, "appointment.exam_start") ? (
            <DsButton disabled={busy} loading={busy} onClick={() => void runExamAction(selected, "/start", "Đã bắt đầu khám")}>
              Bắt đầu khám
            </DsButton>
          ) : null}
          {selected.status === "IN_PROGRESS" && can(user, "appointment.exam_finish") ? (
            <DsButton disabled={busy} loading={busy} onClick={() => void runExamAction(selected, "/complete", "Đã kết thúc khám")}>
              Kết thúc khám
            </DsButton>
          ) : null}
          <Link href="/dashboard/medical-records" className="ds-btn ds-btn--primary">
            Mở hồ sơ khám
          </Link>
        </>
      }
    >
      {selected.allergies ? <DsNotice tone="bad">Dị ứng đã khai báo: {selected.allergies}</DsNotice> : null}
      <DsKeyValue
        items={[
          { label: "Mã lịch hẹn", value: <span className="ds-mono">{selected.bookingCode}</span> },
          { label: "Điện thoại", value: selected.patientPhone },
          { label: "Lý do khám", value: selected.reason || "Khám bác sĩ" },
          { label: "Dị ứng", value: selected.allergies || "Không khai báo" },
        ]}
      />
      <DsStepList
        steps={[
          {
            id: "record",
            title: "Hồ sơ khám",
            detail: recordFor(selected) ? `Bản nháp ${recordFor(selected)?.recordCode}` : "Mở để xem hoặc hoàn thiện",
            action: (
              <Link href="/dashboard/medical-records" className="ds-link">
                Mở
              </Link>
            ),
          },
          {
            id: "results",
            title: "Kết quả cận lâm sàng",
            detail: "Thêm trong hồ sơ khám",
            action: (
              <Link href="/dashboard/medical-records" className="ds-link">
                Thêm
              </Link>
            ),
          },
          {
            id: "prescription",
            title: "Đơn thuốc",
            detail: prescriptionFor(selected) ? `Bản nháp ${prescriptionFor(selected)?.prescriptionCode}` : "Kê từ hồ sơ khám",
            action: (
              <Link href="/dashboard/prescriptions" className="ds-link">
                Mở
              </Link>
            ),
          },
        ]}
      />
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Việc của tôi"
        description={`${formatVietnamDate(today)}${slotText ? ` · slot hôm nay: ${slotText}` : ""}`}
        actions={
          <>
            <DsButton onClick={() => void result.refetch()} disabled={result.isFetching} aria-label="Làm mới dữ liệu">
              <RefreshCw className={result.isFetching ? "ds-spin" : undefined} aria-hidden="true" />
              Làm mới
            </DsButton>
            <Link href="/dashboard/schedules" className="ds-btn">
              Lịch làm việc
            </Link>
          </>
        }
      />

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {result.error ? (
          <DsNotice tone="bad">
            {result.error instanceof Error ? result.error.message : "Không tải được dữ liệu hôm nay"}
          </DsNotice>
        ) : null}
        {error ? <DsNotice tone="bad">{error}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>

      <DsSplit
        list={
          <>
            <DsPanel title="Cần xử lý ngay" flush>
              {todos.length ? (
                todos.map((todo) => (
                  <div key={todo.id} className="ds-todo">
                    <span className={`ds-todo__dot${todo.warn ? " is-warn" : ""}`} aria-hidden="true" />
                    <div className="ds-todo__text">
                      <strong>{todo.title}</strong>
                      <small>{todo.caption}</small>
                    </div>
                    {todo.appointmentId ? (
                      <DsButton onClick={() => setSelectedId(todo.appointmentId)}>{todo.action}</DsButton>
                    ) : (
                      <Link href={todo.href} className="ds-btn">
                        {todo.action}
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, padding: "20px 16px", color: "var(--ds-muted)" }}>
                  {result.isLoading ? "Đang tải việc cần làm..." : "Không có việc nào cần xử lý ngay."}
                </p>
              )}
            </DsPanel>

            <DsPanel flush>
              <DsTabs label="Lọc ca khám theo trạng thái" items={tabs} value={tab} onChange={(id) => setTab(id as TabId)} />
              <DsDataTable
                caption="Lịch khám hôm nay"
                columns={columns}
                rows={visible}
                rowKey={(row) => row.id}
                loading={result.isLoading}
                emptyTitle="Chưa có ca khám nào"
                emptyDescription="Ca khám sẽ hiện ở đây khi có lịch hẹn mới trong ngày."
                selectedKey={selectedId}
                onRowClick={(row) => setSelectedId(row.id === selectedId ? null : row.id)}
              />
            </DsPanel>
          </>
        }
        pane={pane}
      />
    </>
  );
}

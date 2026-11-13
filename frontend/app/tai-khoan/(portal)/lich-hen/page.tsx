"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { DateBlock, doctorLine, StatusChip, timeRange } from "@/components/patient/appointment-parts";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useCancelAppointment, usePatientAppointments } from "@/features/portal/hooks";
import { formatWeekdayDate } from "@/lib/format";
import type { PatientAppointment } from "@/lib/patient-portal-types";
import { ACTIVE_APPOINTMENT_STATUSES, CANCELLABLE_APPOINTMENT_STATUSES, CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-status";

type Filter = "upcoming" | "history" | "cancelled";

const TABS: { key: Filter; label: string; empty: string }[] = [
  { key: "upcoming", label: "Sắp tới", empty: "Chưa có lịch khám sắp tới" },
  { key: "history", label: "Đã khám", empty: "Chưa có lịch đã khám" },
  { key: "cancelled", label: "Đã hủy", empty: "Không có lịch đã hủy" },
];

const MIN_REASON = 3;
const startOf = (item: PatientAppointment) => new Date(`${item.appointmentDate.slice(0, 10)}T${item.startTime || "00:00"}`);

function applyFilter(items: PatientAppointment[], filter: Filter) {
  const now = new Date();
  const matches = items.filter((item) => {
    if (filter === "cancelled") return CANCELLED_APPOINTMENT_STATUSES.has(item.status);
    const active = ACTIVE_APPOINTMENT_STATUSES.has(item.status);
    if (filter === "upcoming") return active && startOf(item) >= now;
    return item.status === "COMPLETED" || (active && startOf(item) < now);
  });
  // Sắp tới: gần nhất trước. Còn lại: mới nhất trước.
  return matches.sort((a, b) => (filter === "upcoming" ? 1 : -1) * (startOf(a).getTime() - startOf(b).getTime()));
}

export default function PatientAppointmentsPage() {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const query = usePatientAppointments();
  const cancel = useCancelAppointment(() => {
    setCancelId(null);
    setReason("");
  });
  const items = useMemo(() => applyFilter(query.data || [], filter), [filter, query.data]);
  const tab = TABS.find((item) => item.key === filter)!;

  return (
    <div className="space-y-5">
      <PatientPageHeader
        title="Lịch hẹn"
        action={
          <Link href="/dat-lich" className="public-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Đặt lịch mới
          </Link>
        }
      />

      <div role="tablist" aria-label="Lọc lịch hẹn" className="flex gap-6 border-b border-[var(--public-border)]">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`-mb-px min-h-11 border-b-2 text-sm font-semibold transition-colors ${
              filter === item.key ? "border-[var(--public-primary)] text-[var(--public-primary-dark)]" : "border-transparent text-[var(--public-muted)] hover:text-[var(--public-ink)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <PatientPageLoading label="Đang tải lịch hẹn..." />
      ) : query.isError ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được lịch hẹn."} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <PatientEmptyState
          title={tab.empty}
          description={filter === "upcoming" ? "Lịch mới đặt sẽ xuất hiện ở đây ngay sau khi bạn xác thực OTP." : "Các lịch phù hợp sẽ tự xuất hiện ở đây khi có thay đổi."}
          action={filter === "upcoming" ? <Link href="/dat-lich" className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Đặt lịch khám</Link> : undefined}
        />
      ) : (
        <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
          {items.map((item) => {
            const canCancel = CANCELLABLE_APPOINTMENT_STATUSES.has(item.status);
            const cancelling = cancelId === item.id;
            const reasonTooShort = reason.trim().length < MIN_REASON;
            return (
              <li key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <DateBlock date={item.appointmentDate} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="font-bold tabular-nums">{timeRange(item)}</p>
                      <StatusChip status={item.status} />
                    </div>
                    <p className="text-sm text-[var(--public-muted)]">{formatWeekdayDate(item.appointmentDate)}</p>
                    <p className="mt-1.5 text-sm font-semibold">{doctorLine(item)}</p>
                    <p className="text-sm text-[var(--public-muted)]">{item.department.name}{item.package ? ` · ${item.package.name}` : ""}</p>
                    <p className="mt-1 text-xs text-[var(--public-muted)]">Mã {item.bookingCode}{item.patientName ? ` · ${item.patientName}` : ""}</p>
                  </div>
                </div>

                {cancelling ? (
                  <div className="mt-4 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] p-3">
                    <label className="block text-sm font-semibold text-[var(--public-danger)]">
                      Lý do hủy lịch
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Nhập lý do cụ thể (tối thiểu 3 ký tự)"
                        className="ui-field mt-1.5 w-full px-3 py-2.5 text-base font-normal text-[var(--public-ink)] sm:text-sm"
                      />
                    </label>
                    {cancel.isError ? <p role="alert" className="mt-2 text-sm font-medium text-[var(--public-danger)]">{cancel.error instanceof Error ? cancel.error.message : "Không hủy được lịch. Thử lại sau."}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => !reasonTooShort && cancel.mutate({ id: item.id, reason: reason.trim() })}
                        aria-disabled={reasonTooShort}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--public-danger)] px-4 text-sm font-semibold text-white ${reasonTooShort ? "opacity-60" : ""}`}
                      >
                        {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Xác nhận hủy
                      </button>
                      <button type="button" onClick={() => { setCancelId(null); setReason(""); }} className="public-button-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">
                        Giữ lịch
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 pl-[4.25rem]">
                    <Link href={`/tai-khoan/lich-hen/${item.id}`} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Xem chi tiết</Link>
                    {canCancel ? (
                      <button type="button" onClick={() => { setCancelId(item.id); setReason(""); }} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)]">
                        Hủy lịch
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { CalendarPlus, ChevronRight, FileHeart, LogOut, ReceiptText } from "lucide-react";
import { DateBlock, doctorLine, StatusChip, timeRange } from "@/components/patient/appointment-parts";
import { PatientPageError, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { usePortalOverview, useUnreadNotificationCount } from "@/features/portal/hooks";
import { PORTAL_GROUPS } from "@/features/portal/nav";
import { formatMoney, formatShortDate } from "@/lib/format";
import { usePatientAuth } from "@/lib/patient-auth";
import type { PatientAppointment, PatientMedicalRecord } from "@/lib/patient-portal-types";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/patient-status";
import { useRouter } from "next/navigation";

const RECENT_RESULT_DAYS = 14;

const startOf = (item: PatientAppointment) => new Date(`${item.appointmentDate.slice(0, 10)}T${item.startTime || "00:00"}`);

function findUpcoming(items: PatientAppointment[]) {
  const now = new Date();
  return items
    .filter((item) => ACTIVE_APPOINTMENT_STATUSES.has(item.status) && startOf(item) >= now)
    .sort((a, b) => startOf(a).getTime() - startOf(b).getTime())[0];
}

// Kết quả khám được công bố trong vài ngày gần đây thì nhắc xem.
function findRecentResult(records: PatientMedicalRecord[]) {
  const now = Date.now();
  return records.find((record) => {
    const published = record.publishedAt ? Date.parse(record.publishedAt) : 0;
    return published > 0 && now - published < RECENT_RESULT_DAYS * 86_400_000;
  });
}

export default function PatientPortalPage() {
  const router = useRouter();
  const { logout } = usePatientAuth();
  const query = usePortalOverview();
  const unread = useUnreadNotificationCount(true).data ?? 0;

  if (query.isLoading) return <PatientPageLoading label="Đang tải tổng quan..." />;
  if (query.isError || !query.data) {
    return <PatientPageError message={query.error instanceof Error ? query.error.message : "Vui lòng thử lại."} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  const upcoming = findUpcoming(data.appointments.items);
  const unpaid = data.invoices.items.find((item) => item.status === "UNPAID");
  const recentResult = findRecentResult(data.medicalRecords.items);
  const history = data.appointments.items.filter((item) => item !== upcoming && !ACTIVE_APPOINTMENT_STATUSES.has(item.status)).slice(0, 3);
  const todo = [
    unpaid && { key: "invoice", href: `/tai-khoan/hoa-don/${unpaid.id}`, icon: ReceiptText, title: "Hóa đơn chờ thanh toán", note: `${unpaid.invoiceCode} · ${unpaid.appointment.department.name}`, trailing: formatMoney(unpaid.finalAmount), warn: true },
    recentResult && { key: "result", href: `/tai-khoan/ho-so-suc-khoe/ket-qua/${recentResult.id}`, icon: FileHeart, title: "Có kết quả khám mới", note: `${recentResult.recordCode} · công bố ${formatShortDate(recentResult.publishedAt)}`, trailing: "", warn: false },
  ].filter(Boolean) as Array<{ key: string; href: string; icon: typeof FileHeart; title: string; note: string; trailing: string; warn: boolean }>;

  const handleLogout = async () => {
    await logout();
    router.replace("/tai-khoan/dang-nhap");
  };

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--public-muted)]">Xin chào</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{data.profile.fullName}</h1>
        </div>
        <Link href="/dat-lich" className="public-button-primary hidden min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold sm:inline-flex">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Đặt lịch mới
        </Link>
      </header>

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="mb-2 text-sm font-semibold text-[var(--public-muted)]">Lịch sắp tới</h2>
        {upcoming ? (
          <div className="rounded-xl border-2 border-[var(--public-primary)] bg-[var(--public-surface)] p-4 sm:p-5">
            <div className="flex items-start gap-4">
              <DateBlock date={upcoming.appointmentDate} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-lg font-bold tabular-nums">{timeRange(upcoming)}, {formatShortDate(upcoming.appointmentDate)}</p>
                  <StatusChip status={upcoming.status} />
                </div>
                <p className="mt-1 font-medium">{doctorLine(upcoming)}</p>
                <p className="text-sm text-[var(--public-muted)]">{upcoming.department.name}{upcoming.package ? ` · ${upcoming.package.name}` : ""} · Mã {upcoming.bookingCode}</p>
              </div>
            </div>
            <Link href={`/tai-khoan/lich-hen/${upcoming.id}`} className="public-button-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold sm:w-auto">
              Xem chi tiết hoặc hủy lịch
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--public-border)] p-5">
            <p className="font-bold">Bạn chưa có lịch khám sắp tới</p>
            <p className="mt-1 text-sm text-[var(--public-muted)]">Chọn chuyên khoa, bác sĩ và giờ trống, mất chừng một phút.</p>
            <Link href="/dat-lich" className="public-button-primary mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Đặt lịch khám
            </Link>
          </div>
        )}
      </section>

      {todo.length ? (
        <section aria-labelledby="todo-heading">
          <h2 id="todo-heading" className="mb-2 text-sm font-semibold text-[var(--public-muted)]">Cần làm</h2>
          <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
            {todo.map(({ key, href, icon: Icon, title, note, trailing, warn }) => (
              <li key={key}>
                <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-[var(--public-surface-muted)]">
                  <Icon className={`h-5 w-5 shrink-0 ${warn ? "text-[var(--public-warning)]" : "text-[var(--public-primary)]"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block truncate text-xs text-[var(--public-muted)]">{note}</span>
                  </span>
                  {trailing ? <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--public-warning)]">{trailing}</span> : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history.length ? (
        <section aria-labelledby="history-heading">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="history-heading" className="text-sm font-semibold text-[var(--public-muted)]">Lịch gần đây</h2>
            <Link href="/tai-khoan/lich-hen" className="text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem tất cả</Link>
          </div>
          <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
            {history.map((item) => (
              <li key={item.id}>
                <Link href={`/tai-khoan/lich-hen/${item.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--public-surface-muted)]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{doctorLine(item)}</span>
                    <span className="block text-xs text-[var(--public-muted)]">{formatShortDate(item.appointmentDate)} · {item.department.name}</span>
                  </span>
                  <StatusChip status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="menu-heading" className="lg:hidden">
        <h2 id="menu-heading" className="sr-only">Tất cả mục trong tài khoản</h2>
        {PORTAL_GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 text-sm font-semibold text-[var(--public-muted)]">{group.title}</p>
            <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-[var(--public-surface-muted)]">
                      <Icon className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block truncate text-xs text-[var(--public-muted)]">{item.hint}</span>
                      </span>
                      {item.showUnread && unread > 0 ? <span className="rounded-full bg-[var(--public-danger)] px-2 py-0.5 text-xs font-bold tabular-nums text-white">{unread}</span> : null}
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <button type="button" onClick={handleLogout} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--public-border)] text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)]">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Đăng xuất
        </button>
      </section>
    </div>
  );
}

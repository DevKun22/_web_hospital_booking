"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { CalendarDays, CalendarX, CheckCheck, ChevronLeft, ChevronRight, HeartPulse, Megaphone, Pill, Receipt, RefreshCw, BellRing } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useMutationToast } from "@/components/patient/patient-toast";
import { type NotificationFilter } from "@/features/portal/api";
import { useNotificationMutations, usePatientNotifications } from "@/features/portal/hooks";
import type { PatientNotification } from "@/lib/patient-portal-types";

type Visual = { icon: ComponentType<{ className?: string }>; danger?: boolean };

// Biểu tượng theo loại thông báo; chỉ lịch hủy và hoàn tiền dùng tông đỏ.
function visualOf(type: string): Visual {
  if (type === "APPOINTMENT_CANCELLED" || type === "APPOINTMENT_NO_SHOW") return { icon: CalendarX, danger: true };
  if (type === "PAYMENT_REFUNDED") return { icon: Receipt, danger: true };
  if (type === "APPOINTMENT_REMINDER") return { icon: BellRing };
  if (type.startsWith("APPOINTMENT_")) return { icon: CalendarDays };
  if (type === "MEDICAL_RESULT_PUBLISHED") return { icon: HeartPulse };
  if (type.startsWith("PRESCRIPTION_")) return { icon: Pill };
  if (type === "INVOICE_CREATED" || type === "PAYMENT_SUCCEEDED") return { icon: Receipt };
  return { icon: Megaphone };
}

function notificationDestination(item: PatientNotification) {
  if (!item.entityId) return null;
  const id = encodeURIComponent(item.entityId);
  const entityType = item.entityType?.toUpperCase();
  if (entityType === "APPOINTMENT" && item.type.startsWith("APPOINTMENT_")) return `/tai-khoan/lich-hen/${id}`;
  if (entityType === "MEDICAL_RECORD" && item.type === "MEDICAL_RESULT_PUBLISHED") return `/tai-khoan/ho-so-suc-khoe/ket-qua/${id}`;
  if (entityType === "PRESCRIPTION" && ["PRESCRIPTION_ISSUED", "PRESCRIPTION_DISPENSED"].includes(item.type)) return `/tai-khoan/ho-so-suc-khoe/don-thuoc/${id}`;
  if (entityType === "INVOICE" && ["INVOICE_CREATED", "PAYMENT_SUCCEEDED", "PAYMENT_REFUNDED"].includes(item.type)) return `/tai-khoan/hoa-don/${id}`;
  return null;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY = 86_400_000;

function groupOf(value: string, now: number) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Trước đó";
  const diff = startOfDay(new Date(now)) - startOfDay(new Date(time));
  return diff <= 0 ? "Hôm nay" : diff <= DAY ? "Hôm qua" : "Trước đó";
}

// Hôm nay và hôm qua chỉ cần giờ; tin cũ hơn ghi ngày.
function timeLabel(value: string, group: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return group === "Trước đó"
    ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

const GROUP_ORDER = ["Hôm nay", "Hôm qua", "Trước đó"];
const ROW_CLASS = "flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-[var(--public-surface-muted)]";

function Row({ item, group, onRead }: { item: PatientNotification; group: string; onRead: (id: string) => void }) {
  const { icon: Icon, danger } = visualOf(item.type);
  const destination = notificationDestination(item);
  const body = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${danger ? "bg-[var(--public-danger-soft)] text-[var(--public-danger)]" : "bg-[var(--public-primary-soft)] text-[var(--public-primary)]"}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${item.isRead ? "font-normal" : "font-bold"}`}>
          {item.title} <time dateTime={item.publishedAt || item.createdAt} className="font-normal tabular-nums text-[var(--public-muted)]">· {timeLabel(item.publishedAt || item.createdAt, group)}</time>
        </span>
        <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-[var(--public-text-soft)]">{item.body}</span>
      </span>
      {!item.isRead ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--public-primary)]"><span className="sr-only">Chưa đọc</span></span> : null}
    </>
  );
  const markRead = () => {
    if (!item.isRead) onRead(item.id);
  };
  return (
    <li>
      {destination ? (
        <Link href={destination} onClick={markRead} className={ROW_CLASS}>{body}</Link>
      ) : (
        <button type="button" onClick={markRead} className={ROW_CLASS}>{body}</button>
      )}
    </li>
  );
}

export default function PatientNotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());
  const query = usePatientNotifications(filter, page);
  const { markRead, markAll } = useNotificationMutations();
  useMutationToast(markRead, { fallbackError: "Chưa thể cập nhật trạng thái thông báo." });
  useMutationToast(markAll, { success: "Đã đánh dấu tất cả đã đọc.", fallbackError: "Chưa thể cập nhật trạng thái thông báo." });

  const items = query.data?.data || [];
  const meta = query.data?.meta;
  const unreadCount = meta?.unreadCount || 0;
  const totalPages = Math.max(meta?.totalPages || 1, 1);

  const grouped = GROUP_ORDER.map((group) => ({ group, items: items.filter((item) => groupOf(item.publishedAt || item.createdAt, now) === group) })).filter((entry) => entry.items.length);

  const changeFilter = (next: NotificationFilter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PatientPageHeader
        title="Thông báo"
        description="Lịch khám, kết quả, đơn thuốc, hóa đơn và tin từ cơ sở khám."
        action={unreadCount > 0 ? (
          <button type="button" disabled={markAll.isPending} onClick={() => markAll.mutate()} className="public-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50">
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> Đánh dấu tất cả đã đọc
          </button>
        ) : undefined}
      />

      <div className="flex items-center justify-between gap-2 border-b border-[var(--public-border)]">
        <div role="tablist" aria-label="Lọc thông báo" className="flex gap-6">
          {([{ key: "all", label: "Tất cả" }, { key: "unread", label: unreadCount > 0 ? `Chưa đọc (${unreadCount})` : "Chưa đọc" }] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => changeFilter(item.key)}
              className={`-mb-px min-h-11 border-b-2 text-sm font-semibold transition-colors ${filter === item.key ? "border-[var(--public-primary)] text-[var(--public-primary-dark)]" : "border-transparent text-[var(--public-muted)] hover:text-[var(--public-ink)]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Làm mới thông báo" className="inline-flex h-11 w-11 items-center justify-center text-[var(--public-muted)] hover:text-[var(--public-primary)] disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {query.isLoading ? (
        <PatientPageLoading label="Đang tải thông báo..." />
      ) : query.isError ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được thông báo."} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <PatientEmptyState
          title={filter === "unread" ? "Bạn đã đọc tất cả thông báo" : "Chưa có thông báo"}
          description={filter === "unread" ? "Thông báo mới sẽ xuất hiện tại đây." : "Cập nhật về lịch khám, hồ sơ và thanh toán sẽ được lưu tại đây."}
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(({ group, items: groupItems }) => (
            <section key={group} aria-label={group}>
              <h2 className="mb-2 text-sm font-semibold text-[var(--public-muted)]">{group}</h2>
              <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
                {groupItems.map((item) => (
                  <Row key={item.id} item={item} group={group} onRead={(id) => markRead.mutate(id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Phân trang thông báo" className="flex items-center justify-between gap-3">
          <button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="public-button-secondary inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Trước
          </button>
          <span className="text-sm tabular-nums text-[var(--public-muted)]">Trang {page}/{totalPages}</span>
          <button type="button" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="public-button-secondary inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">
            Sau <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

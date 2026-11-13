"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import {
  PatientEmptyState,
  PatientPageError,
  PatientPageHeader,
  PatientPageLoading,
} from "@/components/patient/patient-page-ui";
import type { PatientNotification } from "@/lib/patient-portal-types";


import { type NotificationFilter } from "@/features/portal/api";
import { useNotificationMutations, usePatientNotifications } from "@/features/portal/hooks";
const typeConfig: Record<string, { label: string }> = {
  SYSTEM_ANNOUNCEMENT: { label: "Thông báo bệnh viện" },
  APPOINTMENT_CONFIRMED: { label: "Lịch hẹn" },
  APPOINTMENT_RESCHEDULED: { label: "Đổi lịch" },
  APPOINTMENT_CANCELLED: { label: "Hủy lịch" },
  APPOINTMENT_REMINDER: { label: "Nhắc lịch" },
  APPOINTMENT_NO_SHOW: { label: "Lịch hẹn" },
  APPOINTMENT_CHECKED_IN: { label: "Đã tiếp nhận" },
  APPOINTMENT_IN_PROGRESS: { label: "Đang khám" },
  APPOINTMENT_COMPLETED: { label: "Hoàn thành khám" },
  MEDICAL_RESULT_PUBLISHED: { label: "Kết quả khám" },
  PRESCRIPTION_ISSUED: { label: "Đơn thuốc" },
  PRESCRIPTION_DISPENSED: { label: "Đã cấp thuốc" },
  INVOICE_CREATED: { label: "Hóa đơn" },
  PAYMENT_SUCCEEDED: { label: "Thanh toán" },
  PAYMENT_REFUNDED: { label: "Hoàn tiền" },
};

const fallbackType = { label: "Thông báo" };

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

export default function PatientNotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const query = usePatientNotifications(filter, page);
  const { markRead: markReadMutation, markAll: markAllMutation } = useNotificationMutations();

  const items = query.data?.data || [];
  const meta = query.data?.meta;
  const unreadCount = meta?.unreadCount || 0;
  const totalPages = Math.max(meta?.totalPages || 1, 1);
  const isMutating = markReadMutation.isPending || markAllMutation.isPending;
  const mutationError = markReadMutation.error || markAllMutation.error;

  const changeFilter = (next: NotificationFilter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PatientPageHeader
        title="Thông báo"
        description="Thay đổi lịch khám, kết quả, đơn thuốc, hóa đơn và thông tin từ bệnh viện."
        action={unreadCount > 0 ? (
          <button type="button" disabled={isMutating} onClick={() => markAllMutation.mutate()} className="public-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> Đánh dấu tất cả đã đọc ({unreadCount})
          </button>
        ) : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Lọc thông báo" className="flex gap-2">
          {([{ key: "all", label: "Tất cả" }, { key: "unread", label: "Chưa đọc" }] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => changeFilter(item.key)}
              className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${filter === item.key ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-text-soft)]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-[var(--public-primary)] disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" /> Làm mới
        </button>
      </div>

      {mutationError ? <p role="alert" className="text-sm text-[var(--public-danger)]">{mutationError instanceof Error ? mutationError.message : "Chưa thể cập nhật trạng thái thông báo."}</p> : null}

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
        <ul aria-label="Danh sách thông báo" className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
          {items.map((item) => {
            const config = typeConfig[item.type] || fallbackType;
            const destination = notificationDestination(item);
            return (
              <li key={item.id} className={`p-4 ${item.isRead ? "" : "border-l-4 border-l-[var(--public-primary)]"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm text-[var(--public-muted)]">
                    {config.label}
                    {!item.isRead ? <span className="ml-2 font-semibold text-[var(--public-primary)]">Chưa đọc</span> : null}
                  </p>
                  <time dateTime={item.publishedAt || item.createdAt} className="text-sm tabular-nums text-[var(--public-muted)]">{formatNotificationTime(item.publishedAt || item.createdAt)}</time>
                </div>
                <h2 className="mt-0.5 text-base font-bold leading-6">{item.title}</h2>
                <p className="mt-1 whitespace-pre-line text-base leading-7 text-[var(--public-text-soft)]">{item.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4">
                  {destination ? (
                    <Link href={destination} onClick={() => { if (!item.isRead) markReadMutation.mutate(item.id); }} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">
                      Xem chi tiết <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {!item.isRead ? (
                    <button type="button" disabled={isMutating} onClick={() => markReadMutation.mutate(item.id)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--public-text-soft)] disabled:opacity-50">
                      <Check className="h-4 w-4" aria-hidden="true" /> Đánh dấu đã đọc
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
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

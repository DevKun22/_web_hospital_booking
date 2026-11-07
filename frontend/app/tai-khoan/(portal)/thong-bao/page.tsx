"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileHeart,
  Megaphone,
  Pill,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import {
  PatientEmptyState,
  PatientPageError,
  PatientPageHeader,
  PatientPageLoading,
} from "@/components/patient/patient-page-ui";
import { patientPortalRequest } from "@/lib/patient-portal-api";
import type { PatientNotification } from "@/lib/patient-portal-types";

type NotificationFilter = "all" | "unread";

const typeConfig: Record<string, { label: string; icon: typeof Bell; tone: string }> = {
  SYSTEM_ANNOUNCEMENT: { label: "Thông báo bệnh viện", icon: Megaphone, tone: "bg-teal-50 text-teal-700" },
  APPOINTMENT_CONFIRMED: { label: "Lịch hẹn", icon: CalendarClock, tone: "bg-emerald-50 text-emerald-700" },
  APPOINTMENT_RESCHEDULED: { label: "Đổi lịch", icon: CalendarClock, tone: "bg-amber-50 text-amber-800" },
  APPOINTMENT_CANCELLED: { label: "Hủy lịch", icon: CalendarClock, tone: "bg-red-50 text-red-700" },
  APPOINTMENT_REMINDER: { label: "Nhắc lịch", icon: CalendarClock, tone: "bg-blue-50 text-blue-700" },
  APPOINTMENT_NO_SHOW: { label: "Lịch hẹn", icon: CalendarClock, tone: "bg-slate-100 text-slate-700" },
  APPOINTMENT_CHECKED_IN: { label: "Đã tiếp nhận", icon: CalendarClock, tone: "bg-blue-50 text-blue-700" },
  APPOINTMENT_IN_PROGRESS: { label: "Đang khám", icon: CalendarClock, tone: "bg-violet-50 text-violet-700" },
  APPOINTMENT_COMPLETED: { label: "Hoàn thành khám", icon: CalendarClock, tone: "bg-emerald-50 text-emerald-700" },
  MEDICAL_RESULT_PUBLISHED: { label: "Kết quả khám", icon: FileHeart, tone: "bg-emerald-50 text-emerald-700" },
  PRESCRIPTION_ISSUED: { label: "Đơn thuốc", icon: Pill, tone: "bg-violet-50 text-violet-700" },
  PRESCRIPTION_DISPENSED: { label: "Đã cấp thuốc", icon: Pill, tone: "bg-emerald-50 text-emerald-700" },
  INVOICE_CREATED: { label: "Hóa đơn", icon: ReceiptText, tone: "bg-amber-50 text-amber-800" },
  PAYMENT_SUCCEEDED: { label: "Thanh toán", icon: WalletCards, tone: "bg-emerald-50 text-emerald-700" },
  PAYMENT_REFUNDED: { label: "Hoàn tiền", icon: WalletCards, tone: "bg-blue-50 text-blue-700" },
};

const fallbackType = { label: "Thông báo", icon: Bell, tone: "bg-slate-100 text-slate-700" };

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
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["patient-notifications", filter, page],
    queryFn: () => patientPortalRequest<PatientNotification[]>(`/thong-bao?page=${page}&limit=10${filter === "unread" ? "&unread=true" : ""}`),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const refreshNotificationState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["patient-notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["patient-notifications-unread-count"] }),
    ]);
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) => patientPortalRequest<PatientNotification>(`/thong-bao/${id}/da-doc`, { method: "PATCH" }),
    onSuccess: refreshNotificationState,
  });
  const markAllMutation = useMutation({
    mutationFn: () => patientPortalRequest<{ updatedCount: number; unreadCount: number }>("/thong-bao/doc-tat-ca", { method: "PATCH" }),
    onSuccess: refreshNotificationState,
  });

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

  return <div className="space-y-6">
    <PatientPageHeader
      eyebrow="Cập nhật dành cho bạn"
      title="Thông báo"
      description="Theo dõi thay đổi lịch khám, kết quả, đơn thuốc, hóa đơn và thông tin từ bệnh viện."
      action={unreadCount > 0 ? <button type="button" disabled={isMutating} onClick={() => markAllMutation.mutate()} className="public-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"><CheckCheck className="h-4 w-4" aria-hidden="true" /> Đánh dấu tất cả đã đọc</button> : undefined}
    />

    <section aria-label="Tổng quan thông báo" className="grid gap-3 sm:grid-cols-2">
      <article className="flex items-center gap-4 rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]"><BellRing className="h-5 w-5" aria-hidden="true" /></span><div><strong className="block text-2xl tabular-nums">{unreadCount}</strong><span className="mt-1 block text-xs text-[var(--public-muted)]">Thông báo chưa đọc</span></div></article>
      <article className="flex items-center gap-4 rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Bell className="h-5 w-5" aria-hidden="true" /></span><div><strong className="block text-2xl tabular-nums">{meta?.total || 0}</strong><span className="mt-1 block text-xs text-[var(--public-muted)]">Thông báo trong nhóm đang xem</span></div></article>
    </section>

    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--public-border)] bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div role="tablist" aria-label="Lọc thông báo" className="flex gap-2 overflow-x-auto">{([
        { key: "all", label: "Tất cả" },
        { key: "unread", label: "Chưa đọc" },
      ] as const).map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => changeFilter(item.key)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${filter === item.key ? "bg-[var(--public-primary)] text-white" : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}>{item.label}</button>)}</div>
      <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" /> Làm mới</button>
    </div>

    {mutationError ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{mutationError instanceof Error ? mutationError.message : "Chưa thể cập nhật trạng thái thông báo."}</p> : null}

    {query.isLoading ? <PatientPageLoading label="Đang tải thông báo..." /> : query.isError ? <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được thông báo."} onRetry={() => query.refetch()} /> : items.length === 0 ? <PatientEmptyState title={filter === "unread" ? "Bạn đã đọc tất cả thông báo" : "Chưa có thông báo"} description={filter === "unread" ? "Thông báo mới sẽ xuất hiện tại đây khi có cập nhật từ hệ thống." : "Các cập nhật về lịch khám, hồ sơ và thanh toán sẽ được lưu tại đây."} /> : <section aria-label="Danh sách thông báo" className="space-y-3">{items.map((item) => {
      const config = typeConfig[item.type] || fallbackType;
      const Icon = config.icon;
      const destination = notificationDestination(item);
      return <article key={item.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition sm:p-5 ${item.isRead ? "border-[var(--public-border)]" : "border-blue-200 ring-1 ring-blue-100"}`}>
        <div className="flex items-start gap-3 sm:gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${config.tone}`}>{config.label}</span>{!item.isRead ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" /> Chưa đọc</span> : null}</div><h2 className="mt-2 text-base font-bold leading-6 sm:text-lg">{item.title}</h2></div><time dateTime={item.publishedAt || item.createdAt} className="shrink-0 text-xs font-medium text-[var(--public-muted)]">{formatNotificationTime(item.publishedAt || item.createdAt)}</time></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--public-text-soft)]">{item.body}</p><div className="mt-4 flex flex-wrap items-center justify-end gap-2">{!item.isRead ? <button type="button" disabled={isMutating} onClick={() => markReadMutation.mutate(item.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" /> Đánh dấu đã đọc</button> : null}{destination ? <Link href={destination} onClick={() => { if (!item.isRead) markReadMutation.mutate(item.id); }} className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold">Xem chi tiết <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}</div></div></div>
      </article>;
    })}</section>}

    {totalPages > 1 ? <nav aria-label="Phân trang thông báo" className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--public-border)] bg-white p-3 shadow-sm"><button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Trang trước</button><span className="text-sm font-semibold tabular-nums text-[var(--public-muted)]">Trang {page}/{totalPages}</span><button type="button" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40">Trang sau <ChevronRight className="h-4 w-4" aria-hidden="true" /></button></nav> : null}
  </div>;
}

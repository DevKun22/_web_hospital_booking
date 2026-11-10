"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsEmptyState, DsNotice, DsPageHeader, DsPanel, DsStatusPill, DsTabs, DsToolbar, DsToolbarSpacer } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";

// Hộp thư của chính người đăng nhập: thông báo từ quản trị và sự kiện nội bộ (lịch hẹn, yêu cầu đổi lịch...).

type InboxItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  publishedAt: string | null;
  createdAt: string;
  isRead: boolean;
};

type InboxResult = {
  items: InboxItem[];
  meta: { page: number; totalPages: number; total: number; unreadCount: number };
};

const inboxQueryKey = ["dashboard", "inbox"] as const;

const targetFor = (item: InboxItem, role?: string) => {
  if (item.entityType === "MEDICINE" || item.entityType === "MEDICINE_EXPIRY") return "/dashboard/medicines";
  if (item.entityType === "PRESCRIPTION") return role === "PHARMACIST" ? "/dashboard/pharmacy" : "/dashboard/prescriptions";
  if (item.entityType === "INVOICE") return "/dashboard/invoices";
  if (item.entityType === "APPOINTMENT") return "/dashboard/appointments";
  if (item.entityType === "SCHEDULE_CHANGE_REQUEST") return "/dashboard/schedules";
  return null;
};

const typeLabel = (type: string) => {
  if (type === "SYSTEM_ANNOUNCEMENT") return "Thông báo chung";
  if (type.startsWith("SCHEDULE_REQUEST")) return "Lịch làm việc";
  if (type.startsWith("APPOINTMENT")) return "Lịch hẹn";
  return "Thông báo";
};

export default function DashboardInboxPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [...inboxQueryKey, tab, page],
    queryFn: () =>
      apiRequest<InboxResult>("/dashboard/inbox", {
        query: { page, limit: 20, unread: tab === "unread" ? "true" : undefined },
      }),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  const refresh = () => queryClient.invalidateQueries({ queryKey: inboxQueryKey });
  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest(`/dashboard/inbox/${id}/read`, { method: "PATCH" }),
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: () => apiRequest("/dashboard/inbox/read-all", { method: "PATCH" }),
    onSuccess: refresh,
  });

  const openItem = (item: InboxItem) => {
    if (!item.isRead) markRead.mutate(item.id);
    const target = targetFor(item, user?.role);
    if (target) router.push(target);
  };

  const error = query.error instanceof Error ? query.error.message : markRead.error instanceof Error ? markRead.error.message : markAll.error instanceof Error ? markAll.error.message : "";

  return (
    <>
      <DsPageHeader title="Thông báo của tôi" description="Việc cần chú ý dành riêng cho bạn: lịch hẹn, yêu cầu đổi lịch và thông báo từ quản trị." />
      {error ? <DsNotice tone="bad">{error}</DsNotice> : null}
      <DsPanel flush>
        <DsToolbar>
          <DsTabs
            label="Lọc thông báo"
            items={[
              { id: "all", label: "Tất cả", count: tab === "all" ? meta?.total : undefined },
              { id: "unread", label: "Chưa đọc", count: meta?.unreadCount },
            ]}
            value={tab}
            onChange={(id) => {
              setTab(id as "all" | "unread");
              setPage(1);
            }}
          />
          <DsToolbarSpacer />
          <DsButton disabled={!meta?.unreadCount || markAll.isPending} onClick={() => markAll.mutate()}>
            Đánh dấu đã đọc tất cả
          </DsButton>
        </DsToolbar>
        {query.isLoading ? (
          <p className="ds-hint" style={{ padding: 16 }}>Đang tải...</p>
        ) : items.length ? (
          <div role="listbox" aria-label="Danh sách thông báo">
            {items.map((item) => (
              <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={!item.isRead} onClick={() => openItem(item)}>
                <span className="ds-listrow__main" style={{ whiteSpace: "normal" }}>
                  <strong style={{ whiteSpace: "normal" }}>{item.title}</strong>
                  <small style={{ whiteSpace: "normal" }}>{item.body}</small>
                  <small>{formatVietnamDateTime(item.publishedAt || item.createdAt)}</small>
                </span>
                <DsStatusPill tone={item.isRead ? "neutral" : "info"}>{item.isRead ? typeLabel(item.type) : `Mới · ${typeLabel(item.type)}`}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title={tab === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"} />
        )}
        {meta && meta.totalPages > 1 ? (
          <div className="ds-pager">
            <DsButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trước</DsButton>
            <span>Trang {meta.page} / {meta.totalPages}</span>
            <DsButton disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Sau</DsButton>
          </div>
        ) : null}
      </DsPanel>
    </>
  );
}

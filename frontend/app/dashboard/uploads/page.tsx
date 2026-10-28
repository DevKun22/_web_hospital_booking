"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardStatusBadge,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type CleanupUnusedMediaAssetsResult, useDashboardUploads } from "@/lib/dashboard-uploads-query";
import { formatVietnamDateTime } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import type { MediaAsset } from "@/lib/types";

const statusOptions = [
  { label: "Tất cả trạng thái", value: "" },
  { label: "Chưa sử dụng", value: "false" },
  { label: "Đang sử dụng", value: "true" },
];

const folderOptions = [
  { label: "Tất cả thư mục", value: "" },
  { label: "Chuyên khoa", value: "hospital/departments" },
  { label: "Người dùng", value: "hospital/users" },
  { label: "Bác sĩ", value: "hospital/doctors" },
  { label: "Gói khám", value: "hospital/packages" },
  { label: "Kết quả y tế", value: "hospital/medical-results" },
  { label: "Cấu hình trang người dùng", value: "hospital/site-settings" },
  { label: "Ảnh quảng bá", value: "hospital/banners" },
];

const formatBytes = (value: number | null) => {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const formatDateTime = (value: string) => formatVietnamDateTime(value);

export default function UploadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === "ADMIN" || user?.role === "STAFF";
  const canDelete = user?.role === "ADMIN";
  const [isUsed, setIsUsed] = useState("false");
  const [folder, setFolder] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [olderThanHours, setOlderThanHours] = useState("24");
  const [cleanupLimit, setCleanupLimit] = useState("50");
  const [cleanupResult, setCleanupResult] = useState<CleanupUnusedMediaAssetsResult | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const query = useMemo(
    () => ({
      isUsed: isUsed || undefined,
      folder: folder || undefined,
      page,
      limit: 20,
    }),
    [folder, isUsed, page],
  );

  const uploadsQuery = useDashboardUploads(query, canManage);
  const assets = uploadsQuery.data?.items ?? [];
  const pagination = uploadsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };
  const loading = uploadsQuery.isLoading || (uploadsQuery.isFetching && !assets.length);
  const queryError = uploadsQuery.error instanceof Error
    ? uploadsQuery.error.message
    : uploadsQuery.error
      ? "Không tải được danh sách ảnh đã tải lên"
      : "";

  const invalidateUploads = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardUploads });
  };

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const deleteAsset = async () => {
    if (!deleteTarget || !canDelete) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<MediaAsset>(`/uploads/images/${deleteTarget.id}`, { method: "DELETE" });
      setNotice("Đã xoá ảnh chưa sử dụng");
      setDeleteTarget(null);
      await invalidateUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được ảnh");
    } finally {
      setBusy(false);
    }
  };

  const cleanupUnused = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCleanupResult(null);

    try {
      const result = await apiRequest<CleanupUnusedMediaAssetsResult>("/uploads/images/cleanup-unused", {
        method: "POST",
        body: {
          olderThanHours: Number(olderThanHours || 24),
          limit: Number(cleanupLimit || 50),
        },
      });
      setCleanupResult(result);
      setNotice(`Đã dọn ${result.deletedCount} ảnh chưa sử dụng`);
      await invalidateUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không dọn được ảnh chưa sử dụng");
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Đã sao chép đường dẫn ảnh");
    } catch {
      setError("Trình duyệt không cho phép sao chép đường dẫn");
    }
  };

  if (!canManage) {
    return (
      <DashboardPageHeader eyebrow="Tài nguyên" title="Thư viện ảnh" description="Phân hệ này chỉ dành cho quản trị viên hoặc nhân viên tiếp nhận." />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardFeedback error={error || queryError} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />

      <DashboardPageHeader
        eyebrow="Tài nguyên"
        title="Thư viện ảnh"
        description="Theo dõi ảnh đã dùng, ảnh tạm chưa gắn với dữ liệu và dọn ảnh thừa trên Cloudinary."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={isUsed} onChange={(event) => { setIsUsed(event.target.value); setPage(1); }} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={folder} onChange={(event) => { setFolder(event.target.value); setPage(1); }} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]">
              {folderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={() => void invalidateUploads()} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)]">Tải lại</button>
            {canDelete ? (
              <button type="button" onClick={() => setCleanupOpen((current) => !current)} className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${cleanupOpen ? "border-[#b3261e] bg-[#fff3f2] text-[#b3261e]" : "border-[#f2b8b5] text-[#b3261e] hover:bg-[#fff3f2]"}`}>
                {cleanupOpen ? "Đóng dọn ảnh" : "Dọn ảnh nhàn rỗi"}
              </button>
            ) : null}
          </div>
        }
      />

      {canDelete && cleanupOpen ? (
        <DashboardSurface className="border-amber-200 bg-amber-50/60 p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto] lg:items-end">
            <div>
              <h3 className="font-semibold text-[#7a4c00]">Dọn ảnh chưa sử dụng</h3>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Chỉ xoá ảnh chưa được sử dụng và cũ hơn thời gian chỉ định. Hệ thống luôn chặn xoá ảnh đang được dùng.
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-soft)]">Cũ hơn</span>
              <div className="mt-1 flex rounded-md border border-[var(--border)] bg-[var(--surface)]">
                <input value={olderThanHours} onChange={(event) => setOlderThanHours(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
                <span className="border-l border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]">giờ</span>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-soft)]">Giới hạn</span>
              <input value={cleanupLimit} onChange={(event) => setCleanupLimit(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]" />
            </label>
            <button type="button" disabled={busy} onClick={() => void cleanupUnused()} className="rounded-md bg-[#b3261e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8c1d18] disabled:opacity-60">
              {busy ? "Đang xử lý..." : "Dọn ảnh thừa"}
            </button>
          </div>
          {cleanupResult ? (
            <div className="mt-4 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-soft)]">
              Đã quét {cleanupResult.scanned} ảnh, xoá {cleanupResult.deletedCount} ảnh, lỗi {cleanupResult.failedCount} ảnh.
            </div>
          ) : null}
        </DashboardSurface>
      ) : null}

      <DashboardSurface className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Danh sách ảnh</h3>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Tổng {pagination.total} ảnh, trang {pagination.page}/{pagination.totalPages || 1}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50">Trước</button>
            <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50">Sau</button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-soft)]">Đang tải thư viện ảnh...</div>
        ) : assets.length ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 2xl:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.id} className="grid min-w-0 overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface)]" style={{ height: 390, gridTemplateRows: "208px minmax(0, 1fr)" }}>
                <div className="relative min-w-0 overflow-hidden bg-[var(--surface-muted)]" style={{ height: 208, minHeight: 208, maxHeight: 208 }}>
                  <img src={asset.url} alt={asset.publicId} className="block max-w-none object-cover" style={{ display: "block", width: "100%", height: "100%", maxWidth: "none", maxHeight: "none", objectFit: "cover" }} />
                  <DashboardStatusBadge className="absolute left-3 top-3 shadow-sm" tone={asset.isUsed ? "positive" : "warning"}>
                    {asset.isUsed ? "Đang sử dụng" : "Chưa sử dụng"}
                  </DashboardStatusBadge>
                </div>
                <div className="flex min-h-0 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-soft)]">{asset.format || "image"}</span>
                    <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-soft)]">{formatBytes(asset.bytes)}</span>
                  </div>
                  <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-hidden text-sm">
                    <p className="truncate font-medium" title={asset.publicId}>{asset.publicId}</p>
                    <p className="truncate text-[var(--text-soft)]" title={asset.folder}>{asset.folder}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {asset.width || "-"} x {asset.height || "-"} px - {formatDateTime(asset.createdAt)}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]" title={asset.ownerType ? `${asset.ownerType} / ${asset.ownerId || "-"}` : "Chưa gắn dữ liệu"}>
                      {asset.ownerType ? `Chủ sở hữu: ${asset.ownerType} / ${asset.ownerId || "-"}` : "Chưa gắn dữ liệu"}
                    </p>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-3">
                    <button type="button" onClick={() => void copyUrl(asset.url)} className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] px-2 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)]">Sao chép đường dẫn</button>
                    <a href={asset.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] px-2 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)]">Mở ảnh</a>
                    {canDelete && !asset.isUsed ? (
                      <button type="button" onClick={() => setDeleteTarget(asset)} className="col-span-2 inline-flex h-8 items-center justify-center rounded-md border border-[#f2b8b5] px-2 text-xs font-medium text-[#b3261e] hover:bg-[#fff3f2]">Xoá ảnh chưa sử dụng</button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-5"><DashboardEmptyState title="Không có ảnh phù hợp" description="Hãy thay đổi trạng thái hoặc thư mục đang lọc." /></div>
        )}
      </DashboardSurface>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-upload-title" className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <h3 id="delete-upload-title" className="text-lg font-semibold text-[#b3261e]">Xoá ảnh chưa sử dụng?</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Ảnh sẽ bị xoá khỏi dịch vụ lưu trữ và bản ghi tài nguyên ảnh. Thao tác này không áp dụng cho ảnh đang sử dụng.
            </p>
            <div className="mt-4 overflow-hidden rounded-md border border-[var(--border-soft)]">
              <img src={deleteTarget.url} alt={deleteTarget.publicId} className="h-40 w-full object-cover" />
            </div>
            <p className="mt-3 truncate text-xs text-[var(--text-muted)]">{deleteTarget.publicId}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium">Huỷ</button>
              <button type="button" disabled={busy} onClick={() => void deleteAsset()} className="rounded-md bg-[#b3261e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Đang xoá..." : "Xoá ảnh"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

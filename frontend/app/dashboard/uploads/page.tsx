"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DsButton,
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
  DsToolbar,
} from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type CleanupUnusedMediaAssetsResult, useDashboardUploads } from "@/lib/dashboard-uploads-query";
import { formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { MediaAsset } from "@/lib/types";

// Thư viện ảnh: lưới ảnh bên trái; chọn một ảnh thì khung bên phải hiện xem trước, thông tin, sao chép đường dẫn và xóa
// (chỉ ảnh chưa dùng). Công cụ dọn ảnh nhàn rỗi mở trong cùng khung.

const statusTabs = [
  { id: "false", label: "Chưa sử dụng" },
  { id: "true", label: "Đang sử dụng" },
  { id: "", label: "Tất cả" },
];

const folderOptions = [
  { label: "Mọi thư mục", value: "" },
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

type PaneState = { kind: "asset"; id: string } | { kind: "cleanup" } | null;

export default function UploadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(user, "content.manage");
  const canDelete = can(user, "content.delete");
  const [isUsed, setIsUsed] = useState("false");
  const [folder, setFolder] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pane, setPane] = useState<PaneState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [olderThanHours, setOlderThanHours] = useState("24");
  const [cleanupLimit, setCleanupLimit] = useState("50");
  const [cleanupResult, setCleanupResult] = useState<CleanupUnusedMediaAssetsResult | null>(null);

  const query = useMemo(() => ({ isUsed: isUsed || undefined, folder: folder || undefined, page, limit: 24 }), [folder, isUsed, page]);
  const uploadsQuery = useDashboardUploads(query, canManage);
  const assets = uploadsQuery.data?.items ?? [];
  const pagination = uploadsQuery.data?.pagination ?? { page: 1, limit: 24, total: 0, totalPages: 1 };
  const selected = pane?.kind === "asset" ? assets.find((item) => item.id === pane.id) ?? null : null;
  const queryError = uploadsQuery.error instanceof Error ? uploadsQuery.error.message : uploadsQuery.error ? "Không tải được danh sách ảnh đã tải lên" : "";

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

  const closePane = () => {
    setPane(null);
    setConfirmDelete(false);
  };

  const deleteAsset = async () => {
    if (!selected || !canDelete) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<MediaAsset>(`/uploads/images/${selected.id}`, { method: "DELETE" });
      setNotice("Đã xoá ảnh chưa sử dụng");
      closePane();
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
        body: { olderThanHours: Number(olderThanHours || 24), limit: Number(cleanupLimit || 50) },
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
      <>
        <DsPageHeader title="Thư viện ảnh" description="Phân hệ này chỉ dành cho tài khoản được cấp quyền quản lý nội dung" />
        <DsNotice tone="info">Tài khoản của bạn chưa được cấp quyền quản lý thư viện ảnh.</DsNotice>
      </>
    );
  }

  const list = (
    <DsPanel flush>
      <DsToolbar>
        <div style={{ minWidth: 180, flex: "1 1 220px" }}>
          <DsSelect
            aria-label="Lọc theo thư mục"
            value={folder}
            onChange={(event) => {
              setFolder(event.target.value);
              setPage(1);
            }}
          >
            {folderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </DsSelect>
        </div>
        <DsButton onClick={() => void invalidateUploads()}>Tải lại</DsButton>
        {canDelete ? (
          <DsButton
            onClick={() => {
              setCleanupResult(null);
              setPane({ kind: "cleanup" });
            }}
          >
            Dọn ảnh nhàn rỗi
          </DsButton>
        ) : null}
      </DsToolbar>
      <DsTabs
        label="Lọc ảnh theo trạng thái sử dụng"
        items={statusTabs}
        value={isUsed}
        onChange={(id) => {
          setIsUsed(id);
          setPage(1);
          closePane();
        }}
      />
      {uploadsQuery.isLoading ? <p style={{ margin: 0, padding: 16, color: "var(--ds-muted)" }}>Đang tải thư viện ảnh...</p> : null}
      {!uploadsQuery.isLoading && assets.length === 0 ? <DsEmptyState title="Không có ảnh phù hợp" description="Hãy thay đổi trạng thái hoặc thư mục đang lọc." /> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, padding: 12 }}>
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            aria-pressed={pane?.kind === "asset" && pane.id === asset.id}
            onClick={() => {
              setConfirmDelete(false);
              setPane({ kind: "asset", id: asset.id });
            }}
            style={{
              display: "block",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              overflow: "hidden",
              borderRadius: 8,
              border: pane?.kind === "asset" && pane.id === asset.id ? "2px solid var(--ds-accent)" : "1px solid var(--ds-line)",
              background: "var(--ds-surface)",
              color: "inherit",
            }}
          >
            <div style={{ position: "relative", height: 110, background: "var(--ds-sunken)" }}>
              <img src={asset.url} alt={asset.publicId} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <span style={{ position: "absolute", left: 6, top: 6 }}>
                <DsStatusPill tone={asset.isUsed ? "good" : "warn"}>{asset.isUsed ? "Đang dùng" : "Chưa dùng"}</DsStatusPill>
              </span>
            </div>
            <div style={{ padding: "6px 8px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={asset.publicId}>
                {asset.publicId.split("/").pop()}
              </div>
              <div style={{ fontSize: 11, color: "var(--ds-muted)" }}>
                {asset.format || "image"} · {formatBytes(asset.bytes)}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="ds-pager">
        <span>
          {pagination.total} ảnh · trang {pagination.page}/{pagination.totalPages || 1}
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

  const paneNode =
    pane?.kind === "asset" && selected ? (
      <DsPane title={selected.publicId.split("/").pop() || "Ảnh"} badge={<DsStatusPill tone={selected.isUsed ? "good" : "warn"}>{selected.isUsed ? "Đang sử dụng" : "Chưa sử dụng"}</DsStatusPill>} onClose={closePane}>
        <div style={{ display: "grid", gap: 12 }}>
          <img src={selected.url} alt={selected.publicId} style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 6, background: "var(--ds-sunken)" }} />
          <DsKeyValue
            items={[
              { label: "Mã ảnh", value: <span className="ds-mono" style={{ wordBreak: "break-all" }}>{selected.publicId}</span> },
              { label: "Thư mục", value: selected.folder },
              { label: "Định dạng", value: `${selected.format || "image"} · ${formatBytes(selected.bytes)}` },
              { label: "Kích thước", value: `${selected.width || "-"} x ${selected.height || "-"} px` },
              { label: "Tải lên", value: formatVietnamDateTime(selected.createdAt) },
              { label: "Gắn với", value: selected.ownerType ? `${selected.ownerType} / ${selected.ownerId || "-"}` : "Chưa gắn dữ liệu" },
            ]}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DsButton onClick={() => void copyUrl(selected.url)}>Sao chép đường dẫn</DsButton>
            <a href={selected.url} target="_blank" rel="noreferrer" className="ds-btn">
              Mở ảnh
            </a>
          </div>
          {canDelete && !selected.isUsed ? (
            confirmDelete ? (
              <div style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 13 }}>Ảnh sẽ bị xoá khỏi dịch vụ lưu trữ và bản ghi tài nguyên. Không áp dụng cho ảnh đang sử dụng.</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <DsButton variant="danger" disabled={busy} onClick={() => void deleteAsset()}>
                    {busy ? "Đang xoá..." : "Xoá ảnh"}
                  </DsButton>
                  <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
                </div>
              </div>
            ) : (
              <div>
                <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Xoá ảnh chưa sử dụng
                </DsButton>
              </div>
            )
          ) : null}
        </div>
      </DsPane>
    ) : pane?.kind === "cleanup" && canDelete ? (
      <DsPane title="Dọn ảnh chưa sử dụng" onClose={closePane}>
        <div style={{ display: "grid", gap: 12 }}>
          <p className="ds-hint" style={{ margin: 0 }}>
            Chỉ xoá ảnh chưa được sử dụng và cũ hơn thời gian chỉ định. Hệ thống luôn chặn xoá ảnh đang được dùng.
          </p>
          <div className="ds-grid-fields">
            <DsField label="Cũ hơn (giờ)" htmlFor="cl-hours">
              <DsInput id="cl-hours" inputMode="numeric" value={olderThanHours} onChange={(event) => setOlderThanHours(event.target.value.replace(/\D/g, ""))} />
            </DsField>
            <DsField label="Giới hạn số ảnh" htmlFor="cl-limit">
              <DsInput id="cl-limit" inputMode="numeric" value={cleanupLimit} onChange={(event) => setCleanupLimit(event.target.value.replace(/\D/g, ""))} />
            </DsField>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton variant="danger" disabled={busy} onClick={() => void cleanupUnused()}>
              {busy ? "Đang xử lý..." : "Dọn ảnh thừa"}
            </DsButton>
          </div>
          {cleanupResult ? <DsNotice tone="info">Đã quét {cleanupResult.scanned} ảnh, xoá {cleanupResult.deletedCount} ảnh, lỗi {cleanupResult.failedCount} ảnh.</DsNotice> : null}
        </div>
      </DsPane>
    ) : null;

  return (
    <>
      <DsPageHeader title="Thư viện ảnh" description="Ảnh đã dùng, ảnh tạm chưa gắn với dữ liệu và dọn ảnh thừa trên Cloudinary" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {error || queryError ? <DsNotice tone="bad">{error || queryError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit list={list} pane={paneNode} />
    </>
  );
}

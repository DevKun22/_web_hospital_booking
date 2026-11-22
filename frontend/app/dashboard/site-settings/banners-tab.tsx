"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsButton, DsEditDialog, DsEmptyState, DsField, DsInput, DsLoading, DsNotice, DsPanel, DsSelect, DsStatusPill, DsTextarea, DsToolbar, useConfirm } from "@/components/ds";
import { NumberStepper } from "@/components/ui/number-stepper";
import { VietnamDateTimeInput } from "@/components/ui/vietnam-datetime-input";
import { apiRequest } from "@/lib/api";
import { useDashboardBanners } from "@/lib/dashboard-site-settings-query";
import { fromVietnamDateTimeInput } from "@/lib/date";
import { publishPublicContentUpdated } from "@/lib/public-content-sync";
import { queryKeys } from "@/lib/query-keys";
import type { Banner } from "@/lib/types";
import { Check, useImageUpload } from "./site-parts";
import { emptyBannerForm, positionLabels, toBannerForm, toNullable, type BannerForm } from "./site-model";

// Nhóm "Ảnh quảng bá": danh sách có lọc và hộp thoại tạo/sửa (tải ảnh máy tính và điện thoại, lịch hiển thị, bật/tắt, xoá có xác nhận).
// Được gắn khi mở nhóm này nên bộ lọc và hộp thoại luôn bắt đầu sạch.

export function BannersTab({
  canWrite,
  canManage,
  onNotice,
  onError,
}: {
  canWrite: boolean;
  canManage: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editing, setEditing] = useState<{ banner: Banner | null } | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyBannerForm);
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const { uploading, upload } = useImageUpload(onNotice, onError);

  const filters = useMemo(() => ({ position: position || undefined, isActive: activeFilter || undefined }), [position, activeFilter]);
  const query = useDashboardBanners(filters, canManage);
  const banners = query.data ?? [];
  const open = editing !== null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "banners"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "banners"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
    publishPublicContentUpdated();
  };

  const close = () => {
    setEditing(null);
  };

  const openBanner = (banner: Banner | null) => {
    setForm(banner ? toBannerForm(banner) : emptyBannerForm);
    setEditing({ banner });
  };

  const patch = (changes: Partial<BannerForm>) => setForm((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!canManage || !editing) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const body = {
        title: form.title.trim(),
        subtitle: toNullable(form.subtitle),
        image: form.image.trim(),
        imageAssetId: form.imageAssetId || undefined,
        mobileImage: toNullable(form.mobileImage),
        mobileImageAssetId: form.mobileImageAssetId || undefined,
        linkUrl: toNullable(form.linkUrl),
        target: toNullable(form.target),
        position: form.position.trim() || "HOME_HERO",
        order: Number(form.order || 0),
        isActive: form.isActive,
        startAt: fromVietnamDateTimeInput(form.startAt),
        endAt: fromVietnamDateTimeInput(form.endAt),
      };
      if (editing.banner) {
        await apiRequest<Banner>(`/dashboard/banners/${editing.banner.id}`, { method: "PATCH", body });
        onNotice("Đã cập nhật ảnh quảng bá");
      } else {
        await apiRequest<Banner>("/dashboard/banners", { method: "POST", body });
        onNotice("Đã tạo ảnh quảng bá");
      }
      close();
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không lưu được ảnh quảng bá");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (banner: Banner) => {
    if (!canManage) return;
    onError("");
    onNotice("");
    try {
      await apiRequest<Banner>(`/dashboard/banners/${banner.id}`, { method: "PATCH", body: { isActive: !banner.isActive } });
      close();
      onNotice(banner.isActive ? "Đã tắt ảnh quảng bá" : "Đã bật ảnh quảng bá");
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được ảnh quảng bá");
    }
  };

  const askDelete = async () => {
    if (!(await confirm({ title: `Xoá ảnh quảng bá “${current?.title ?? ""}”?`, message: "Không hoàn tác được.", confirmLabel: "Xoá ảnh", tone: "danger" }))) return;
    await remove();
  };

  const remove = async () => {
    if (!canWrite || !editing?.banner) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      await apiRequest<Banner>(`/dashboard/banners/${editing.banner.id}`, { method: "DELETE" });
      close();
      onNotice("Đã xoá ảnh quảng bá");
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xoá được ảnh quảng bá");
    } finally {
      setSaving(false);
    }
  };

  const imagePicker = (key: "image" | "mobileImage", label: string) => (
    <div style={{ display: "grid", gap: 8 }}>
      <DsField label={label} htmlFor={`bn-${key}`} required={key === "image"}>
        <DsInput id={`bn-${key}`} value={form[key]} placeholder="https://..." onChange={(event) => patch({ [key]: event.target.value, [`${key}AssetId`]: "" } as Partial<BannerForm>)} />
      </DsField>
      <input
        type="file"
        aria-label={`Tải ${label} lên`}
        disabled={uploading === `banner-${key}`}
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => void upload(event.target.files?.[0], "banners", `banner-${key}`, (asset) => patch({ [key]: asset.url, [`${key}AssetId`]: asset.id } as Partial<BannerForm>))}
      />
      {uploading === `banner-${key}` ? <DsLoading label="Đang tải ảnh lên..." className="ds-loading--inline" /> : null}
      {form[key] ? <img src={form[key]} alt={`Xem trước ${label}`} style={{ maxHeight: 120, maxWidth: "100%", objectFit: "contain", borderRadius: 6, background: "var(--ds-sunken)" }} /> : null}
    </div>
  );

  const current = editing?.banner ?? null;

  return (
    <>
      {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được ảnh quảng bá"}</DsNotice> : null}
      <DsPanel flush>
        <DsToolbar>
          <div style={{ minWidth: 160, flex: "1 1 200px" }}>
            <DsSelect aria-label="Lọc theo vị trí" value={position} onChange={(event) => setPosition(event.target.value)}>
              <option value="">Mọi vị trí</option>
              {Object.entries(positionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </DsSelect>
          </div>
          <div style={{ minWidth: 140 }}>
            <DsSelect aria-label="Lọc theo trạng thái" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="true">Đang bật</option>
              <option value="false">Đang tắt</option>
            </DsSelect>
          </div>
          <DsButton variant="primary" onClick={() => openBanner(null)}>Tạo ảnh quảng bá</DsButton>
        </DsToolbar>
        {query.isLoading ? (
          <DsLoading />
        ) : banners.length ? (
          <div role="listbox" aria-label="Danh sách ảnh quảng bá">
            {banners.map((banner) => (
              <button key={banner.id} type="button" role="option" className="ds-listrow" aria-selected={current?.id === banner.id} onClick={() => openBanner(banner)}>
                <img src={banner.image} alt="" style={{ width: open ? 56 : 120, height: open ? 36 : 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                <span className="ds-listrow__main">
                  <strong>{banner.title}</strong>
                  <small>{positionLabels[banner.position] || banner.position} · thứ tự {banner.order}{banner.linkUrl && !open ? ` · ${banner.linkUrl}` : ""}</small>
                </span>
                <DsStatusPill tone={banner.isActive ? "good" : "neutral"}>{banner.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có ảnh quảng bá phù hợp" />
        )}
      </DsPanel>

      {editing ? (
        <DsEditDialog
          size="lg"
          title={current ? "Sửa ảnh quảng bá" : "Tạo ảnh quảng bá"}
          badge={current ? <DsStatusPill tone={current.isActive ? "good" : "neutral"}>{current.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill> : undefined}
          onClose={close}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <DsField label="Tiêu đề" htmlFor="bn-title" required>
              <DsInput id="bn-title" value={form.title} onChange={(event) => patch({ title: event.target.value })} />
            </DsField>
            <DsField label="Mô tả phụ" htmlFor="bn-subtitle">
              <DsTextarea id="bn-subtitle" rows={2} value={form.subtitle} onChange={(event) => patch({ subtitle: event.target.value })} />
            </DsField>
            {imagePicker("image", "Ảnh trên máy tính")}
            {imagePicker("mobileImage", "Ảnh trên điện thoại")}
            <div className="ds-grid-fields">
              <DsField label="Vị trí" htmlFor="bn-position">
                <DsSelect id="bn-position" value={form.position} onChange={(event) => patch({ position: event.target.value })}>
                  {Object.entries(positionLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </DsSelect>
              </DsField>
              <DsField label="Thứ tự" hint="Số nhỏ hiển thị trước">
                <NumberStepper label="Thứ tự hiển thị" value={Number(form.order || 0)} min={0} max={999} onChange={(value) => patch({ order: String(value) })} />
              </DsField>
            </div>
            <div className="ds-grid-fields">
              <DsField label="Đường dẫn khi bấm" htmlFor="bn-link">
                <DsInput id="bn-link" value={form.linkUrl} placeholder="/goi-kham" onChange={(event) => patch({ linkUrl: event.target.value })} />
              </DsField>
              <DsField label="Cách mở" htmlFor="bn-target">
                <DsSelect id="bn-target" value={form.target} onChange={(event) => patch({ target: event.target.value })}>
                  <option value="_self">Cùng tab</option>
                  <option value="_blank">Tab mới</option>
                </DsSelect>
              </DsField>
            </div>
            <div className="ds-grid-fields">
              <DsField label="Bắt đầu" hint="Để trống: hiển thị ngay">
                <VietnamDateTimeInput ariaLabel="Bắt đầu hiển thị ảnh" value={form.startAt} onChange={(value) => patch({ startAt: value })} />
              </DsField>
              <DsField label="Kết thúc" hint="Để trống: hiển thị mãi">
                <VietnamDateTimeInput ariaLabel="Kết thúc hiển thị ảnh" value={form.endAt} onChange={(value) => patch({ endAt: value })} />
              </DsField>
            </div>
            <Check id="bn-active" checked={form.isActive} onChange={(isActive) => patch({ isActive })} label="Đang bật" />
            <div className="ds-form-actions">
              {current ? (
                <>
                  <DsButton onClick={() => void toggle(current)}>{current.isActive ? "Tắt ngay" : "Bật ngay"}</DsButton>
                  {canWrite ? <DsButton variant="ghost" onClick={() => void askDelete()}>Xoá</DsButton> : null}
                </>
              ) : null}
              <DsButton onClick={close}>Đóng</DsButton>
              <DsButton variant="primary" disabled={saving || Boolean(uploading) || !form.title.trim() || !form.image.trim()} onClick={() => void save()}>
                {saving ? "Đang lưu..." : current ? "Lưu thay đổi" : "Tạo ảnh quảng bá"}
              </DsButton>
            </div>
          </div>
        </DsEditDialog>
      ) : null}
    </>
  );
}

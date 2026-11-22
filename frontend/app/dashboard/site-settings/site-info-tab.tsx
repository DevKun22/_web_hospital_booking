"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsField, DsInput, DsLoading, DsNotice, DsPanel, DsTextarea } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useDashboardSiteSettings } from "@/lib/dashboard-site-settings-query";
import { formatVietnamDateTime } from "@/lib/date";
import { publishPublicContentUpdated } from "@/lib/public-content-sync";
import { queryKeys } from "@/lib/query-keys";
import type { SiteSettingsRecord, SiteSettingsValue } from "@/lib/types";
import { SaveBar, useImageUpload } from "./site-parts";
import { emptySiteForm, toNullable, toSiteForm, type SiteForm } from "./site-model";

// Nhóm "Thông tin hiển thị công khai": tên, liên hệ, mạng xã hội, logo và favicon. Luôn được gắn (chỉ ẩn khi sang nhóm khác) để chỉnh sửa chưa lưu không mất khi đổi nhóm.

export function SiteInfoTab({
  active,
  canWrite,
  canManage,
  onNotice,
  onError,
}: {
  active: boolean;
  canWrite: boolean;
  canManage: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const query = useDashboardSiteSettings(canManage && active);
  const record = query.data;
  const [form, setForm] = useState<SiteForm>(emptySiteForm);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const { uploading, upload } = useImageUpload(onNotice, onError);

  useEffect(() => {
    if (!query.data || ready) return;
    const timeoutId = window.setTimeout(() => {
      if (!query.data) return;
      setReady(true);
      setForm(toSiteForm(query.data.value));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [query.data, ready]);

  const update = (patch: Partial<SiteForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSiteSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicSiteSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
    publishPublicContentUpdated();
  };

  const save = async () => {
    if (!canWrite) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const socialLinks = {
        ...(form.facebook.trim() ? { facebook: form.facebook.trim() } : {}),
        ...(form.zalo.trim() ? { zalo: form.zalo.trim() } : {}),
        ...(form.youtube.trim() ? { youtube: form.youtube.trim() } : {}),
        ...(form.tiktok.trim() ? { tiktok: form.tiktok.trim() } : {}),
      };
      const payload: Partial<SiteSettingsValue> & { logoAssetId?: string; faviconAssetId?: string } = {
        hospitalName: toNullable(form.hospitalName || ""),
        logo: toNullable(form.logo || ""),
        logoAssetId: form.logoAssetId || undefined,
        favicon: toNullable(form.favicon || ""),
        faviconAssetId: form.faviconAssetId || undefined,
        hotline: toNullable(form.hotline || ""),
        emergencyHotline: toNullable(form.emergencyHotline || ""),
        email: toNullable(form.email || ""),
        address: toNullable(form.address || ""),
        workingHours: toNullable(form.workingHours || ""),
        mapUrl: toNullable(form.mapUrl || ""),
        socialLinks,
      };
      const updated = await apiRequest<SiteSettingsRecord>("/dashboard/site-settings", { method: "PATCH", body: payload });
      queryClient.setQueryData(queryKeys.dashboardSiteSettings, updated);
      setForm(toSiteForm(updated.value));
      setDirty(false);
      await invalidate();
      onNotice("Đã cập nhật thông tin trang người dùng");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không lưu được thông tin trang người dùng");
    } finally {
      setSaving(false);
    }
  };

  const imageField = (key: "logo" | "favicon", label: string) => (
    <div style={{ display: "grid", gap: 8 }}>
      <DsField label={label} htmlFor={`site-${key}`} hint="Dán đường dẫn ảnh hoặc tải ảnh lên bên dưới">
        <DsInput id={`site-${key}`} disabled={!canWrite} value={form[key] || ""} placeholder="https://..." onChange={(event) => update({ [key]: event.target.value, [`${key}AssetId`]: "" } as Partial<SiteForm>)} />
      </DsField>
      {canWrite ? (
        <input
          type="file"
          aria-label={`Tải ${label} lên`}
          disabled={uploading === key}
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico"
          onChange={(event) => void upload(event.target.files?.[0], "site-settings", key, (asset) => update({ [key]: asset.url, [`${key}AssetId`]: asset.id } as Partial<SiteForm>))}
        />
      ) : null}
      {uploading === key ? <DsLoading label="Đang tải ảnh lên..." className="ds-loading--inline" /> : null}
      {form[key] ? <img src={form[key] || ""} alt={`Xem trước ${label}`} style={{ height: 80, maxWidth: "100%", objectFit: "contain", borderRadius: 6, background: "var(--ds-sunken)", padding: 6 }} /> : null}
    </div>
  );

  return (
    <div hidden={!active}>
      {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được cấu hình trang người dùng"}</DsNotice> : null}
      <DsPanel title="Thông tin hiển thị công khai" actions={<span className="ds-hint">Cập nhật {record?.updatedAt ? formatVietnamDateTime(record.updatedAt) : "-"}</span>}>
        {query.isLoading ? (
          <DsLoading />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="ds-grid-fields">
              <DsField label="Tên cơ sở khám" htmlFor="site-name">
                <DsInput id="site-name" disabled={!canWrite} value={form.hospitalName || ""} onChange={(event) => update({ hospitalName: event.target.value })} />
              </DsField>
              <DsField label="Email" htmlFor="site-email">
                <DsInput id="site-email" disabled={!canWrite} value={form.email || ""} onChange={(event) => update({ email: event.target.value })} />
              </DsField>
              <DsField label="Hotline" htmlFor="site-hotline">
                <DsInput id="site-hotline" disabled={!canWrite} value={form.hotline || ""} onChange={(event) => update({ hotline: event.target.value })} />
              </DsField>
              <DsField label="Hotline cấp cứu" htmlFor="site-emergency">
                <DsInput id="site-emergency" disabled={!canWrite} value={form.emergencyHotline || ""} onChange={(event) => update({ emergencyHotline: event.target.value })} />
              </DsField>
            </div>
            <DsField label="Địa chỉ" htmlFor="site-address">
              <DsTextarea id="site-address" rows={2} disabled={!canWrite} value={form.address || ""} onChange={(event) => update({ address: event.target.value })} />
            </DsField>
            <div className="ds-grid-fields">
              <DsField label="Giờ làm việc" htmlFor="site-hours">
                <DsTextarea id="site-hours" rows={2} disabled={!canWrite} value={form.workingHours || ""} onChange={(event) => update({ workingHours: event.target.value })} />
              </DsField>
              <DsField label="Đường dẫn bản đồ" htmlFor="site-map">
                <DsTextarea id="site-map" rows={2} disabled={!canWrite} value={form.mapUrl || ""} onChange={(event) => update({ mapUrl: event.target.value })} />
              </DsField>
            </div>
            <div className="ds-grid-fields">
              {(["facebook", "zalo", "youtube", "tiktok"] as const).map((key) => (
                <DsField key={key} label={key === "facebook" ? "Facebook" : key === "zalo" ? "Zalo" : key === "youtube" ? "YouTube" : "TikTok"} htmlFor={`site-${key}`}>
                  <DsInput id={`site-${key}`} disabled={!canWrite} value={form[key]} onChange={(event) => update({ [key]: event.target.value } as Partial<SiteForm>)} />
                </DsField>
              ))}
            </div>
            <div className="ds-grid-fields">
              {imageField("logo", "Logo")}
              {imageField("favicon", "Favicon")}
            </div>
          </div>
        )}
        <SaveBar canWrite={canWrite} dirty={dirty} busy={Boolean(uploading)} saving={saving} label="Lưu thông tin" onSave={() => void save()} />
      </DsPanel>
    </div>
  );
}

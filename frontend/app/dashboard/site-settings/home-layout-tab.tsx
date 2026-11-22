"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsField, DsInput, DsNotice, DsPanel, DsTextarea } from "@/components/ds";
import { NumberStepper } from "@/components/ui/number-stepper";
import { VietnamDateTimeInput } from "@/components/ui/vietnam-datetime-input";
import { apiRequest } from "@/lib/api";
import { useDashboardHomePageConfig } from "@/lib/dashboard-site-settings-query";
import { fromVietnamDateTimeInput, toVietnamDateTimeInput } from "@/lib/date";
import { publishPublicContentUpdated } from "@/lib/public-content-sync";
import { queryKeys } from "@/lib/query-keys";
import type { HomePageConfigRecord, HomePageConfigValue, HomePageSectionConfig } from "@/lib/types";
import { Check, SaveBar } from "./site-parts";
import { configurableHomeSections, emptyHomePageForm } from "./site-model";

// Nhóm "Bố cục trang chủ": thanh chương trình, các khối nội dung và vùng chức năng cố định. Luôn được gắn để chỉnh sửa chưa lưu không mất khi đổi nhóm.

export function HomeLayoutTab({
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
  const query = useDashboardHomePageConfig(canManage && active);
  const [form, setForm] = useState<HomePageConfigValue>(emptyHomePageForm);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.data || ready) return;
    const timeoutId = window.setTimeout(() => {
      if (!query.data) return;
      setReady(true);
      setForm(query.data.value);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [query.data, ready]);

  const update = (updater: (current: HomePageConfigValue) => HomePageConfigValue) => {
    setForm(updater);
    setDirty(true);
  };
  const updateAnnouncement = (patch: Partial<HomePageConfigValue["announcement"]>) => update((current) => ({ ...current, announcement: { ...current.announcement, ...patch } }));
  const updateSection = (key: keyof HomePageConfigValue["sections"], patch: Partial<HomePageSectionConfig>) =>
    update((current) => ({ ...current, sections: { ...current.sections, [key]: { ...current.sections[key], ...patch } } }));

  const save = async () => {
    if (!canWrite) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const updated = await apiRequest<HomePageConfigRecord>("/dashboard/homepage-config", { method: "PATCH", body: form });
      queryClient.setQueryData(queryKeys.dashboardHomePageConfig, updated);
      setForm(updated.value);
      setDirty(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardHomePageConfig }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
      ]);
      publishPublicContentUpdated();
      onNotice("Đã cập nhật bố cục và nội dung trang chủ");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không lưu được cấu hình trang chủ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div hidden={!active} style={{ display: active ? "grid" : "none", gap: 16 }}>
      {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được cấu hình trang người dùng"}</DsNotice> : null}
      <DsPanel title="Thanh chương trình dưới ảnh lớn" actions={<Check id="ann-enabled" checked={form.announcement.enabled} disabled={!canWrite} onChange={(enabled) => updateAnnouncement({ enabled })} label="Hiển thị" />}>
        <p className="ds-hint" style={{ marginTop: 0 }}>Nội dung công khai chạy trên trang chủ; không tạo thông báo đẩy tới tài khoản.</p>
        <div className="ds-grid-fields">
          <DsField label="Nhãn chương trình" htmlFor="ann-label">
            <DsInput id="ann-label" disabled={!canWrite} value={form.announcement.label} onChange={(event) => updateAnnouncement({ label: event.target.value })} />
          </DsField>
          <DsField label="Nhãn nút" htmlFor="ann-cta">
            <DsInput id="ann-cta" disabled={!canWrite} value={form.announcement.ctaLabel} onChange={(event) => updateAnnouncement({ ctaLabel: event.target.value })} />
          </DsField>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <DsField label="Nội dung chạy" htmlFor="ann-message">
            <DsTextarea id="ann-message" rows={2} disabled={!canWrite} value={form.announcement.message} onChange={(event) => updateAnnouncement({ message: event.target.value })} />
          </DsField>
          <DsField label="Đường dẫn nút" htmlFor="ann-href">
            <DsInput id="ann-href" disabled={!canWrite} value={form.announcement.ctaHref} placeholder="/goi-kham" onChange={(event) => updateAnnouncement({ ctaHref: event.target.value })} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Bắt đầu hiển thị" hint="Để trống: hiển thị ngay">
              <VietnamDateTimeInput ariaLabel="Bắt đầu hiển thị" disabled={!canWrite} value={toVietnamDateTimeInput(form.announcement.startAt)} onChange={(value) => updateAnnouncement({ startAt: fromVietnamDateTimeInput(value) })} />
            </DsField>
            <DsField label="Kết thúc hiển thị" hint="Để trống: hiển thị mãi">
              <VietnamDateTimeInput ariaLabel="Kết thúc hiển thị" disabled={!canWrite} value={toVietnamDateTimeInput(form.announcement.endAt)} onChange={(value) => updateAnnouncement({ endAt: fromVietnamDateTimeInput(value) })} />
            </DsField>
          </div>
        </div>
      </DsPanel>

      <div className="ds-grid-fields">
        {configurableHomeSections.map(({ key, label }) => {
          const section = form.sections[key];
          return (
            <DsPanel key={key} title={`Khối ${label}`} actions={<Check id={`sec-${key}`} checked={section.enabled} disabled={!canWrite} onChange={(enabled) => updateSection(key, { enabled })} label="Hiển thị" />}>
              <div style={{ display: "grid", gap: 12 }}>
                <DsField label="Nhãn nhỏ" htmlFor={`sec-${key}-eyebrow`}>
                  <DsInput id={`sec-${key}-eyebrow`} disabled={!canWrite} value={section.eyebrow} onChange={(event) => updateSection(key, { eyebrow: event.target.value })} />
                </DsField>
                <DsField label="Tiêu đề" htmlFor={`sec-${key}-title`} required>
                  <DsInput id={`sec-${key}-title`} disabled={!canWrite} value={section.title} onChange={(event) => updateSection(key, { title: event.target.value })} />
                </DsField>
                <DsField label="Mô tả" htmlFor={`sec-${key}-desc`}>
                  <DsTextarea id={`sec-${key}-desc`} rows={2} disabled={!canWrite} value={section.description} onChange={(event) => updateSection(key, { description: event.target.value })} />
                </DsField>
                <DsField label="Số mục hiển thị">
                  <NumberStepper label={`Số mục hiển thị của khối ${label}`} value={section.limit} min={1} max={12} disabled={!canWrite || saving} onChange={(limit) => updateSection(key, { limit })} />
                </DsField>
              </div>
            </DsPanel>
          );
        })}
      </div>

      <DsPanel title="Vùng chức năng cố định">
        <Check id="sec-serviceHub" checked={form.sections.serviceHub.enabled} disabled={!canWrite} onChange={(enabled) => updateSection("serviceHub", { enabled })} label="Dịch vụ nhanh" hint="Các lối tắt đặt lịch, tra cứu và hỗ trợ ngay dưới ảnh lớn" />
        <SaveBar canWrite={canWrite} dirty={dirty} busy={false} saving={saving} label="Lưu bố cục trang chủ" onSave={() => void save()} />
      </DsPanel>
    </div>
  );
}

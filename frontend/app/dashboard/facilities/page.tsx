"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsLoading, DsNotice, DsPageHeader, DsPanel, DsStatusPill, useActionToast, useConfirm } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Facility } from "@/lib/types";

// Cơ sở khám: danh sách địa điểm. Đúng một cơ sở mặc định; ca làm việc mới nhận cơ sở mặc định khi không chọn cơ sở.

const queryKey = ["dashboard", "facilities"];

type FormState = { name: string; address: string; phone: string; workingHours: string; mapUrl: string; isDefault: boolean; isActive: boolean };
const emptyForm: FormState = { name: "", address: "", phone: "", workingHours: "", mapUrl: "", isDefault: false, isActive: true };
const toForm = (facility: Facility): FormState => ({
  name: facility.name,
  address: facility.address,
  phone: facility.phone ?? "",
  workingHours: facility.workingHours ?? "",
  mapUrl: facility.mapUrl ?? "",
  isDefault: facility.isDefault,
  isActive: facility.isActive !== false,
});
const toPayload = (form: FormState) => ({
  name: form.name.trim(),
  address: form.address.trim(),
  phone: form.phone.trim() || null,
  workingHours: form.workingHours.trim() || null,
  mapUrl: form.mapUrl.trim() || null,
  isDefault: form.isDefault,
  isActive: form.isActive,
});

export default function FacilitiesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const canManage = can(user, "catalog.manage");
  const canDelete = can(user, "catalog.delete");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  const query = useQuery({ queryKey, queryFn: () => apiRequest<Facility[]>("/dashboard/facilities"), enabled: can(user, "catalog.view"), staleTime: 0 });
  const facilities = query.data ?? [];

  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: ["public", "facilities"] })]);

  const save = useMutation({
    mutationFn: () =>
      editingId === "new"
        ? apiRequest<Facility>("/dashboard/facilities", { method: "POST", body: toPayload(form) })
        : apiRequest<Facility>(`/dashboard/facilities/${editingId}`, { method: "PATCH", body: toPayload(form) }),
    onSuccess: async () => {
      setNotice(editingId === "new" ? "Đã tạo cơ sở" : "Đã cập nhật cơ sở");
      setEditingId(null);
      await refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Không lưu được cơ sở"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/dashboard/facilities/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setNotice("Đã xóa cơ sở");
      await refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Không xóa được cơ sở"),
  });

  const startEdit = (facility: Facility) => {
    setForm(toForm(facility));
    setEditingId(facility.id);
  };

  const confirmDelete = async (facility: Facility) => {
    const ok = await confirm({ title: "Xóa cơ sở?", message: `${facility.name} sẽ bị xóa. Cơ sở đã có lịch làm việc hoặc lịch hẹn không xóa được, hãy tạm ngừng thay vì xóa.`, confirmLabel: "Xóa", tone: "danger" });
    if (ok) remove.mutate(facility.id);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    save.mutate();
  };

  return (
    <>
      <DsPageHeader
        title="Cơ sở khám"
        description="Địa điểm khám; ca làm việc, khung giờ và lịch hẹn đi theo cơ sở"
        actions={canManage ? <DsButton variant="primary" onClick={() => { setForm(emptyForm); setEditingId("new"); }}>Thêm cơ sở</DsButton> : undefined}
      />
      {query.isLoading ? <DsLoading label="Đang tải cơ sở..." /> : null}
      {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được danh sách"}</DsNotice> : null}

      {editingId ? (
        <DsPanel title={editingId === "new" ? "Thêm cơ sở" : "Sửa cơ sở"}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }} aria-label="Biểu mẫu cơ sở">
            <DsField label="Tên cơ sở" htmlFor="fc-name" required><DsInput id="fc-name" maxLength={160} value={form.name} required onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></DsField>
            <DsField label="Địa chỉ" htmlFor="fc-address" required><DsInput id="fc-address" maxLength={300} value={form.address} required onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></DsField>
            <DsField label="Điện thoại" htmlFor="fc-phone"><DsInput id="fc-phone" maxLength={40} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></DsField>
            <DsField label="Giờ làm việc" htmlFor="fc-hours"><DsInput id="fc-hours" maxLength={200} value={form.workingHours} onChange={(event) => setForm((current) => ({ ...current, workingHours: event.target.value }))} /></DsField>
            <DsField label="Liên kết bản đồ" htmlFor="fc-map" hint="Đường dẫn đầy đủ, ví dụ liên kết chia sẻ vị trí."><DsInput id="fc-map" type="url" maxLength={500} value={form.mapUrl} onChange={(event) => setForm((current) => ({ ...current, mapUrl: event.target.value }))} /></DsField>
            <label className="ds-check">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} style={{ marginTop: 3 }} />
              <span><strong>Cơ sở mặc định</strong><small style={{ display: "block", color: "var(--ds-muted)" }}>Nhận ca làm việc mới khi không chọn cơ sở. Chỉ một cơ sở được đặt mặc định.</small></span>
            </label>
            <label className="ds-check">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} style={{ marginTop: 3 }} />
              <span><strong>Đang hoạt động</strong><small style={{ display: "block", color: "var(--ds-muted)" }}>Cơ sở tạm ngừng không nhận ca mới và không hiện công khai.</small></span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <DsButton type="submit" variant="primary" loading={save.isPending}>Lưu</DsButton>
              <DsButton onClick={() => setEditingId(null)}>Hủy</DsButton>
            </div>
          </form>
        </DsPanel>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {facilities.map((facility) => (
          <DsPanel
            key={facility.id}
            title={facility.name}
            actions={
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {facility.isDefault ? <DsStatusPill tone="info">Mặc định</DsStatusPill> : null}
                {facility.isActive === false ? <DsStatusPill tone="warn">Tạm ngừng</DsStatusPill> : <DsStatusPill tone="good">Hoạt động</DsStatusPill>}
                {canManage ? <DsButton onClick={() => startEdit(facility)}>Sửa</DsButton> : null}
                {canDelete && !facility.isDefault ? <DsButton variant="danger" onClick={() => confirmDelete(facility)} disabled={remove.isPending}>Xóa</DsButton> : null}
              </span>
            }
          >
            <p style={{ margin: 0 }}>{facility.address}</p>
            <p className="ds-hint" style={{ margin: "6px 0 0" }}>
              {[facility.phone, facility.workingHours].filter(Boolean).join(" · ") || "Chưa có điện thoại hoặc giờ làm việc"}
              {facility._count ? ` · ${facility._count.schedules} ca làm việc · ${facility._count.appointments} lịch hẹn` : ""}
            </p>
          </DsPanel>
        ))}
      </div>
    </>
  );
}

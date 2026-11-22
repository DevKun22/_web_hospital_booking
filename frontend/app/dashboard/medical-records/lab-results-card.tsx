"use client";

import { FormEvent, useState } from "react";
import { DsButton, DsField, DsInput, DsTextarea } from "@/components/ds";
import { apiRequest, apiUrl, uploadMedicalFile } from "@/lib/api";
import type { LabResult } from "@/lib/types";
import { FileDrop } from "./file-drop";
import { buildLabPayload, emptyLabForm, toLabForm, type LabForm } from "./record-model";

// Thẻ kết quả cận lâm sàng của một hồ sơ: danh sách, thêm, sửa, xoá (có xác nhận ngay tại dòng) và tải tệp đính kèm.
// Giữ trạng thái biểu mẫu riêng; trang cha đặt key theo mã hồ sơ để đổi hồ sơ thì thẻ về trạng thái sạch.

export function LabResultsCard({
  recordId,
  labResults,
  canEdit,
  onChanged,
  onNotice,
  onError,
}: {
  recordId: string;
  labResults: LabResult[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabResult | null>(null);
  const [form, setForm] = useState<LabForm>(emptyLabForm);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<LabForm>) => setForm((current) => ({ ...current, ...changes }));

  const startAdd = () => {
    setEditing(null);
    setDeleteTarget(null);
    setForm(emptyLabForm);
    setOpen(true);
  };

  const startEdit = (lab: LabResult) => {
    setEditing(lab);
    setDeleteTarget(null);
    setForm(toLabForm(lab));
    setOpen(true);
  };

  const startDelete = (lab: LabResult) => {
    setDeleteTarget(lab);
    setEditing(null);
    setOpen(false);
  };

  const cancelForm = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyLabForm);
  };

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    onError("");
    onNotice("");
    try {
      const asset = await uploadMedicalFile(file);
      patch({ fileUrl: asset.url });
      onNotice("Đã tải tệp cận lâm sàng lên");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được tệp cận lâm sàng lên");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    onError("");
    onNotice("");
    try {
      if (editing) {
        await apiRequest<LabResult>(`/dashboard/medical-records/${recordId}/lab-results/${editing.id}`, { method: "PATCH", body: buildLabPayload(form) });
        onNotice("Đã cập nhật kết quả cận lâm sàng");
      } else {
        await apiRequest<LabResult>(`/dashboard/medical-records/${recordId}/lab-results`, { method: "POST", body: buildLabPayload(form) });
        onNotice("Đã thêm kết quả cận lâm sàng");
      }
      cancelForm();
      setDeleteTarget(null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không lưu được kết quả cận lâm sàng");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    onError("");
    onNotice("");
    try {
      await apiRequest<LabResult>(`/dashboard/medical-records/${recordId}/lab-results/${deleteTarget.id}`, { method: "DELETE" });
      onNotice("Đã xoá kết quả cận lâm sàng");
      setDeleteTarget(null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xoá được kết quả cận lâm sàng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ds-card">
      <div className="ds-card__head">
        <h3>Kết quả cận lâm sàng</h3>
        {canEdit && !open ? <DsButton onClick={startAdd}>Thêm kết quả</DsButton> : null}
      </div>
      {labResults.length === 0 && !open ? <p style={{ margin: 0, padding: "14px", color: "var(--ds-muted)" }}>Chưa có kết quả cận lâm sàng.</p> : null}
      {labResults.map((lab) => (
        <div key={lab.id} className="ds-labrow">
          <div className="ds-labrow__main">
            <strong>{lab.testName}</strong>
            <small>
              {lab.resultValue || "-"} {lab.unit || ""}
              {lab.referenceRange ? ` · tham chiếu ${lab.referenceRange}` : ""}
            </small>
            {lab.conclusion ? <small>{lab.conclusion}</small> : null}
            {lab.fileUrl ? (
              <a href={apiUrl(`/dashboard/medical-records/${recordId}/lab-results/${lab.id}/file`)} target="_blank" rel="noopener" className="ds-link">
                Mở tệp
              </a>
            ) : null}
            {deleteTarget?.id === lab.id ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13 }}>Xoá kết quả này?</span>
                <DsButton variant="danger" loading={busy} onClick={() => void remove()}>
                  Xoá
                </DsButton>
                <DsButton onClick={() => setDeleteTarget(null)}>Giữ lại</DsButton>
              </div>
            ) : null}
          </div>
          {canEdit && deleteTarget?.id !== lab.id ? (
            <span style={{ display: "flex", gap: 4 }}>
              <DsButton variant="ghost" onClick={() => startEdit(lab)}>
                Sửa
              </DsButton>
              <DsButton variant="ghost" onClick={() => startDelete(lab)}>
                Xoá
              </DsButton>
            </span>
          ) : null}
        </div>
      ))}
      {open ? (
        <form className="ds-card__body" onSubmit={save} style={{ borderTop: "1px solid var(--ds-line)" }} aria-label={editing ? "Sửa kết quả" : "Thêm kết quả"}>
          <DsField label="Tên xét nghiệm" htmlFor="lab-name" required>
            <DsInput id="lab-name" value={form.testName} required onChange={(event) => patch({ testName: event.target.value })} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Giá trị" htmlFor="lab-value">
              <DsInput id="lab-value" value={form.resultValue} onChange={(event) => patch({ resultValue: event.target.value })} />
            </DsField>
            <DsField label="Đơn vị" htmlFor="lab-unit">
              <DsInput id="lab-unit" value={form.unit} onChange={(event) => patch({ unit: event.target.value })} />
            </DsField>
            <DsField label="Khoảng tham chiếu" htmlFor="lab-ref">
              <DsInput id="lab-ref" value={form.referenceRange} onChange={(event) => patch({ referenceRange: event.target.value })} />
            </DsField>
          </div>
          <DsField label="Kết luận" htmlFor="lab-conclusion">
            <DsTextarea id="lab-conclusion" rows={2} value={form.conclusion} onChange={(event) => patch({ conclusion: event.target.value })} />
          </DsField>
          {form.fileUrl ? (
            <div className="ds-file">
              <div className="ds-file__text">
                <strong>Đã có tệp đính kèm</strong>
              </div>
              <DsButton variant="ghost" onClick={() => patch({ fileUrl: "" })}>
                Gỡ
              </DsButton>
            </div>
          ) : null}
          <FileDrop inputId="lab-file" busy={uploading} onFile={(file) => void uploadFile(file)} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <DsButton onClick={cancelForm}>Hủy</DsButton>
            <DsButton type="submit" variant="primary" disabled={busy || uploading}>
              {editing ? "Lưu kết quả" : "Thêm kết quả"}
            </DsButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

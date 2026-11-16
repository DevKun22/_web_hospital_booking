"use client";

import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsNotice, DsStatusPill, DsTextarea, useToast } from "@/components/ds";
import { MedicinePicker, availabilityLabel, availabilityTone, medicineDisplayName } from "@/components/dashboard/medicine-picker";
import { PrintButton, PrintablePrescription } from "@/components/dashboard/printable-documents";
import { apiRequest } from "@/lib/api";
import { fetchDashboardPrescription } from "@/lib/dashboard-prescriptions-query";
import { queryKeys } from "@/lib/query-keys";
import type { Prescription, PrescriptionItem } from "@/lib/types";

// Trình soạn đơn thuốc dùng chung cho trang Đơn thuốc và phần Đơn thuốc trong hồ sơ khám: thuốc, ghi chú, phát hành,
// huỷ, và (sau khi phát hành) đánh dấu dòng kho không cấp được. Kết quả mỗi thao tác hiện bằng thông báo nổi.

type ItemForm = {
  // Thuốc chọn từ danh mục kho; null là thuốc ngoài danh mục (gõ tay).
  medicineId: string | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  unit: string;
  instruction: string;
};

const emptyItemForm: ItemForm = { medicineId: null, medicineName: "", dosage: "", frequency: "", duration: "", quantity: "", unit: "", instruction: "" };

const toItemForm = (item: PrescriptionItem): ItemForm => ({
  medicineId: item.medicineId,
  medicineName: item.medicineName,
  dosage: item.dosage || "",
  frequency: item.frequency || "",
  duration: item.duration || "",
  quantity: item.quantity === null ? "" : String(item.quantity),
  unit: item.unit || "",
  instruction: item.instruction || "",
});

const buildItemPayload = (form: ItemForm, sortOrder: number) => ({
  medicineId: form.medicineId,
  medicineName: form.medicineName.trim(),
  dosage: form.dosage.trim() || null,
  frequency: form.frequency.trim() || null,
  duration: form.duration.trim() || null,
  quantity: form.quantity ? Number(form.quantity) : null,
  unit: form.unit.trim() || null,
  instruction: form.instruction.trim() || null,
  sortOrder,
});

const warnColor = { color: "var(--ds-warn, #b45309)" } as const;

/** Hộp xác nhận khi có dòng vượt khả năng cấp của kho: những dòng này sẽ thành "người khám tự mua" và không tính tiền. */
export const confirmShortage = (prescription: Prescription) => {
  const shortItems = prescription.items.filter((item) => item.availability?.short);
  if (shortItems.length === 0) return { proceed: true, acknowledgeShortage: false };
  const proceed = window.confirm(
    `Kho không đủ thuốc cho ${shortItems.length} dòng:\n- ${shortItems.map((item) => item.medicineName).join("\n- ")}\n\nCác dòng này sẽ được đánh dấu "người khám tự mua", không tính tiền và không chờ cấp. Bạn vẫn muốn phát hành?`,
  );
  return { proceed, acknowledgeShortage: proceed };
};

export function PrescriptionEditor({
  prescription,
  canEdit,
  onChange,
  extraActions,
}: {
  prescription: Prescription;
  canEdit: boolean;
  /** Gọi với đơn mới nhất sau mỗi thay đổi để nơi dùng cập nhật dữ liệu đang hiển thị. */
  onChange: (updated: Prescription) => void;
  /** Nút bổ sung ở thanh thao tác (ví dụ "Mở hồ sơ khám"). */
  extraActions?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrescriptionItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrescriptionItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // null: ghi chú chưa sửa (hiện ghi chú đã lưu).
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  const isDraft = prescription.status === "DRAFT";
  const editable = canEdit && isDraft;
  const note = noteDraft ?? prescription.note ?? "";
  const dirtyNote = noteDraft !== null && noteDraft.trim() !== (prescription.note || "").trim();
  const canResolve = canEdit && prescription.status === "ISSUED" && prescription.dispenseStatus !== "DISPENSED";

  const resetItemEditor = () => {
    setItemOpen(false);
    setEditingItem(null);
    setDeleteTarget(null);
    setItemForm(emptyItemForm);
  };

  const refreshLists = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardPrescriptions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardPrescription(prescription.id) }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
    ]);

  // Chạy một thao tác gọi máy chủ: khóa nút, báo kết quả bằng thông báo nổi, cập nhật đơn và các danh sách liên quan.
  const run = async (action: () => Promise<Prescription | void>, successMessage: string, failMessage: string) => {
    setBusy(true);
    try {
      const updated = await action();
      if (updated) onChange(updated);
      toast.success(successMessage);
      await refreshLists();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failMessage);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) return;
    const editing = editingItem;
    const ok = await run(
      () =>
        apiRequest<Prescription>(editing ? `/dashboard/prescriptions/${prescription.id}/items/${editing.id}` : `/dashboard/prescriptions/${prescription.id}/items`, {
          method: editing ? "PATCH" : "POST",
          body: buildItemPayload(itemForm, editing ? editing.sortOrder : prescription.items.length),
        }),
      editing ? "Đã cập nhật thuốc" : "Đã thêm thuốc",
      "Không lưu được thuốc",
    );
    if (ok) resetItemEditor();
  };

  const deleteItem = async () => {
    if (!editable || !deleteTarget) return;
    const target = deleteTarget;
    const ok = await run(
      async () => {
        await apiRequest<PrescriptionItem>(`/dashboard/prescriptions/${prescription.id}/items/${target.id}`, { method: "DELETE" });
        return fetchDashboardPrescription(prescription.id);
      },
      "Đã xoá thuốc",
      "Không xoá được thuốc",
    );
    if (ok) setDeleteTarget(null);
  };

  const saveNote = async () => {
    if (!editable) return;
    const ok = await run(
      () => apiRequest<Prescription>(`/dashboard/prescriptions/${prescription.id}`, { method: "PATCH", body: { note: note.trim() || null } }),
      "Đã lưu ghi chú đơn",
      "Không cập nhật được đơn thuốc",
    );
    if (ok) setNoteDraft(null);
  };

  const issue = async () => {
    const { proceed, acknowledgeShortage } = confirmShortage(prescription);
    if (!proceed) return;
    const ok = await run(
      () =>
        apiRequest<Prescription>(`/dashboard/prescriptions/${prescription.id}/issue`, {
          method: "PATCH",
          body: acknowledgeShortage ? { acknowledgeShortage: true } : undefined,
        }),
      "Đã phát hành đơn",
      "Không phát hành được đơn",
    );
    if (ok) resetItemEditor();
  };

  const cancel = async () => {
    const ok = await run(() => apiRequest<Prescription>(`/dashboard/prescriptions/${prescription.id}/cancel`, { method: "PATCH" }), "Đã huỷ đơn thuốc", "Không huỷ được đơn thuốc");
    if (ok) setConfirmCancel(false);
  };

  // Đơn đã phát hành mà kho không cấp được dòng này (hết hàng sau lúc kê, hoặc người khám tự mua): bác sĩ đánh dấu,
  // tiền thuốc dòng đó được gỡ khỏi hóa đơn chưa thu (hóa đơn đã thu thì chuyển sang luồng hoàn tiền thuốc).
  const resolveItem = async (item: PrescriptionItem, status: "OUTSIDE" | "OUT_OF_STOCK") => {
    const label = status === "OUTSIDE" ? "người khám tự mua" : "kho hết thuốc, người khám mua ngoài";
    if (!window.confirm(`Đánh dấu "${item.medicineName}" là ${label}? Dòng này sẽ không tính tiền và dược sĩ không cấp. Không hoàn tác được.`)) return;
    await run(
      () => apiRequest<Prescription>(`/dashboard/prescriptions/${prescription.id}/items/${item.id}/fulfillment`, { method: "PATCH", body: { status } }),
      "Đã cập nhật dòng thuốc",
      "Không cập nhật được dòng thuốc",
    );
  };

  const setField = (field: keyof ItemForm, value: string) => setItemForm((current) => ({ ...current, [field]: value }));

  return (
    <>
      <div className="ds-savebar" style={{ borderTop: 0, position: "static", paddingTop: 12 }}>
        {editable ? (
          <DsButton
            variant="primary"
            disabled={prescription.items.length === 0 || dirtyNote}
            loading={busy}
            title={prescription.items.length === 0 ? "Cần thêm ít nhất 1 thuốc" : dirtyNote ? "Lưu ghi chú trước khi phát hành" : undefined}
            onClick={() => void issue()}
          >
            Phát hành đơn
          </DsButton>
        ) : null}
        {prescription.status === "ISSUED" ? (
          <>
            <PrintButton label="In đơn thuốc" />
            <PrintablePrescription prescription={prescription} />
          </>
        ) : null}
        {extraActions}
        <span style={{ flex: 1 }} />
        {canEdit && prescription.status !== "CANCELLED" ? (
          confirmCancel ? (
            <>
              <span style={{ fontSize: 13 }}>Huỷ đơn này?</span>
              <DsButton variant="danger" loading={busy} onClick={() => void cancel()}>
                Huỷ đơn
              </DsButton>
              <DsButton onClick={() => setConfirmCancel(false)}>Giữ lại</DsButton>
            </>
          ) : (
            <DsButton variant="ghost" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Huỷ đơn
            </DsButton>
          )
        ) : null}
      </div>
      {editable && prescription.items.length === 0 ? (
        <div style={{ padding: "0 16px" }}>
          <DsNotice tone="warn">Đơn chưa có thuốc. Thêm ít nhất 1 thuốc để phát hành.</DsNotice>
        </div>
      ) : null}

      <div className="ds-editor">
        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Thuốc trong đơn ({prescription.items.length})</h3>
              {editable && !itemOpen ? (
                <DsButton
                  onClick={() => {
                    setEditingItem(null);
                    setDeleteTarget(null);
                    setItemForm(emptyItemForm);
                    setItemOpen(true);
                  }}
                >
                  Thêm thuốc
                </DsButton>
              ) : null}
            </div>
            {prescription.items.length === 0 && !itemOpen ? <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có thuốc.</p> : null}
            {prescription.items.map((item) => (
              <div key={item.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>
                    {item.medicineName}
                    {item.availability ? (
                      <>
                        {" "}
                        <DsStatusPill tone={availabilityTone[item.availability.level]}>{availabilityLabel[item.availability.level]}</DsStatusPill>
                      </>
                    ) : null}
                  </strong>
                  {editable && item.availability && (item.availability.short || item.availability.level === "OUT") ? (
                    <small style={warnColor}>
                      {item.availability.level === "OUT"
                        ? "Kho hiện hết thuốc này. Cân nhắc đổi thuốc tương đương, hoặc giữ nguyên nếu người khám tự mua."
                        : "Số lượng kê vượt khả năng cấp của kho. Cân nhắc giảm số lượng, đổi thuốc, hoặc giữ nguyên nếu phần thiếu do người khám tự mua."}
                    </small>
                  ) : null}
                  <small>
                    {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ") || "Chưa có liều dùng"}
                    {" · "}
                    SL {item.quantity ?? "-"} {item.unit || ""}
                  </small>
                  {item.instruction ? <small>{item.instruction}</small> : null}
                  {item.fulfillmentStatus === "OUT_OF_STOCK" ? (
                    <small style={warnColor}>Kho hết thuốc, người khám mua ngoài{item.fulfillmentNote ? ` · ${item.fulfillmentNote}` : ""}.</small>
                  ) : null}
                  {item.fulfillmentStatus === "OUTSIDE" && item.medicineId ? (
                    <small style={warnColor}>Người khám tự mua{item.fulfillmentNote ? ` · ${item.fulfillmentNote}` : ""}.</small>
                  ) : null}
                  {item.fulfillmentStatus === "DISPENSED" ? <small style={{ color: "var(--ds-muted)" }}>Đã cấp tại cơ sở.</small> : null}
                  {canResolve && item.fulfillmentStatus === "PENDING" && item.medicineId ? (
                    <span style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <DsButton variant="ghost" disabled={busy} onClick={() => void resolveItem(item, "OUT_OF_STOCK")}>
                        Kho hết thuốc này
                      </DsButton>
                      <DsButton variant="ghost" disabled={busy} onClick={() => void resolveItem(item, "OUTSIDE")}>
                        Người khám tự mua
                      </DsButton>
                    </span>
                  ) : null}
                  {deleteTarget?.id === item.id ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>Xoá thuốc này khỏi đơn?</span>
                      <DsButton variant="danger" loading={busy} onClick={() => void deleteItem()}>
                        Xoá
                      </DsButton>
                      <DsButton onClick={() => setDeleteTarget(null)}>Giữ lại</DsButton>
                    </div>
                  ) : null}
                </div>
                {editable && deleteTarget?.id !== item.id ? (
                  <span style={{ display: "flex", gap: 4 }}>
                    <DsButton
                      variant="ghost"
                      onClick={() => {
                        setEditingItem(item);
                        setDeleteTarget(null);
                        setItemForm(toItemForm(item));
                        setItemOpen(true);
                      }}
                    >
                      Sửa
                    </DsButton>
                    <DsButton
                      variant="ghost"
                      onClick={() => {
                        setDeleteTarget(item);
                        setEditingItem(null);
                        setItemOpen(false);
                      }}
                    >
                      Xoá
                    </DsButton>
                  </span>
                ) : null}
              </div>
            ))}
            {itemOpen && editable ? (
              <form className="ds-card__body" onSubmit={saveItem} style={{ borderTop: "1px solid var(--ds-line)" }} aria-label={editingItem ? "Sửa thuốc" : "Thêm thuốc"}>
                <MedicinePicker
                  onPick={(option) =>
                    setItemForm((current) => ({ ...current, medicineId: option.id, medicineName: medicineDisplayName(option), unit: option.unit || current.unit }))
                  }
                />
                <DsField
                  label="Tên thuốc"
                  htmlFor="item-name"
                  required
                  hint={itemForm.medicineId ? "Đã chọn từ danh mục kho. Sửa tên tay thì thuốc trở thành thuốc người khám tự mua." : "Thuốc ngoài danh mục: người khám tự mua."}
                >
                  <DsInput
                    id="item-name"
                    value={itemForm.medicineName}
                    required
                    onChange={(event) => setItemForm((current) => ({ ...current, medicineId: null, medicineName: event.target.value }))}
                  />
                </DsField>
                <div className="ds-grid-fields">
                  <DsField label="Liều dùng" htmlFor="item-dosage">
                    <DsInput id="item-dosage" value={itemForm.dosage} onChange={(event) => setField("dosage", event.target.value)} />
                  </DsField>
                  <DsField label="Tần suất" htmlFor="item-frequency">
                    <DsInput id="item-frequency" value={itemForm.frequency} onChange={(event) => setField("frequency", event.target.value)} />
                  </DsField>
                  <DsField label="Thời gian" htmlFor="item-duration">
                    <DsInput id="item-duration" value={itemForm.duration} onChange={(event) => setField("duration", event.target.value)} />
                  </DsField>
                  <DsField label="Số lượng" htmlFor="item-quantity">
                    <DsInput id="item-quantity" inputMode="numeric" value={itemForm.quantity} onChange={(event) => setField("quantity", event.target.value.replace(/\D/g, ""))} />
                  </DsField>
                  <DsField label="Đơn vị" htmlFor="item-unit">
                    <DsInput id="item-unit" value={itemForm.unit} onChange={(event) => setField("unit", event.target.value)} />
                  </DsField>
                </div>
                <DsField label="Hướng dẫn dùng thuốc" htmlFor="item-instruction">
                  <DsTextarea id="item-instruction" rows={2} value={itemForm.instruction} onChange={(event) => setField("instruction", event.target.value)} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={resetItemEditor}>Hủy</DsButton>
                  <DsButton type="submit" variant="primary" loading={busy}>
                    {editingItem ? "Lưu thuốc" : "Thêm thuốc"}
                  </DsButton>
                </div>
              </form>
            ) : null}
          </div>
        </div>

        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Ghi chú đơn</h3>
            </div>
            <div className="ds-card__body">
              <DsTextarea aria-label="Ghi chú đơn" rows={3} value={note} disabled={!editable} onChange={(event) => setNoteDraft(event.target.value)} />
              {editable ? (
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  {dirtyNote ? <DsStatusPill tone="warn">Chưa lưu</DsStatusPill> : null}
                  <DsButton disabled={!dirtyNote || busy} onClick={() => setNoteDraft(null)}>
                    Hủy thay đổi
                  </DsButton>
                  <DsButton variant="primary" disabled={!dirtyNote} loading={busy} onClick={() => void saveNote()}>
                    Lưu ghi chú
                  </DsButton>
                </div>
              ) : null}
              <p className="ds-hint" style={{ margin: 0 }}>
                Phát hành đơn sẽ gửi cho người khám và chuyển sang hàng đợi cấp thuốc. Đơn đã phát hành không sửa được.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

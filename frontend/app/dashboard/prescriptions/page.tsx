"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
  type DsColumn,
  type DsTone,
} from "@/components/ds";
import { PrintButton, PrintablePrescription } from "@/components/dashboard/printable-documents";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  fetchDashboardPrescription,
  useDashboardPrescription,
  useDashboardPrescriptionDoctors,
  useDashboardPrescriptions,
} from "@/lib/dashboard-prescriptions-query";
import { formatVietnamDateTime } from "@/lib/date";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { DoctorProfile, Prescription, PrescriptionItem, PrescriptionStatus } from "@/lib/types";

// Đơn thuốc: danh sách bên trái; chọn một đơn thì danh sách thu hẹp, khung bên phải để soạn thuốc,
// kiểm tra và phát hành. Đơn đã phát hành chỉ xem và in.

type ItemForm = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  unit: string;
  instruction: string;
};

const emptyItemForm: ItemForm = { medicineName: "", dosage: "", frequency: "", duration: "", quantity: "", unit: "", instruction: "" };

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "DRAFT", label: "Bản nháp" },
  { id: "ISSUED", label: "Đã phát hành" },
  { id: "CANCELLED", label: "Đã huỷ" },
];

const statusLabel: Record<PrescriptionStatus, string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  CANCELLED: "Đã huỷ",
};

const statusTone: Record<PrescriptionStatus, DsTone> = {
  DRAFT: "warn",
  ISSUED: "good",
  CANCELLED: "bad",
};

const doctorName = (doctor: DoctorProfile | Prescription["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const toItemForm = (item: PrescriptionItem): ItemForm => ({
  medicineName: item.medicineName,
  dosage: item.dosage || "",
  frequency: item.frequency || "",
  duration: item.duration || "",
  quantity: item.quantity === null ? "" : String(item.quantity),
  unit: item.unit || "",
  instruction: item.instruction || "",
});

const buildItemPayload = (form: ItemForm, sortOrder: number) => ({
  medicineName: form.medicineName.trim(),
  dosage: form.dosage.trim() || null,
  frequency: form.frequency.trim() || null,
  duration: form.duration.trim() || null,
  quantity: form.quantity ? Number(form.quantity) : null,
  unit: form.unit.trim() || null,
  instruction: form.instruction.trim() || null,
  sortOrder,
});

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [prescriptionCode, setPrescriptionCode] = useState("");
  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const appliedPrescriptionCode = useDebouncedValue(prescriptionCode.trim());
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSnapshot, setSelected] = useState<Prescription | null>(null);
  const [creating, setCreating] = useState(false);
  const [createRecordId, setCreateRecordId] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [note, setNote] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrescriptionItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PrescriptionItem | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);

  const canEdit = can(user, "prescription.write");
  const isDoctor = user?.role === "DOCTOR";

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      q: appliedPrescriptionCode || undefined,
      page,
      limit: 20,
    }),
    [appliedPrescriptionCode, doctorId, isDoctor, page, status],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const prescriptionsQuery = useDashboardPrescriptions(query);
  const doctorsQuery = useDashboardPrescriptionDoctors(doctorQuery, !isDoctor && can(user, "catalog.view"));
  const selectedPrescriptionQuery = useDashboardPrescription(selectedSnapshot?.id);
  const loading = prescriptionsQuery.isLoading;
  const prescriptions = prescriptionsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pagination = prescriptionsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedPrescriptionQuery.data ?? selectedSnapshot;
  const queryError = prescriptionsQuery.error || doctorsQuery.error || selectedPrescriptionQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu đơn thuốc") : "";
  const visibleError = error || queryErrorMessage;
  const isDraft = selected?.status === "DRAFT";
  const editable = canEdit && isDraft;

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const invalidatePrescriptions = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardPrescriptions }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
    ]);
  };

  const refreshSelectedPrescription = async (id: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: queryKeys.dashboardPrescription(id),
      queryFn: () => fetchDashboardPrescription(id),
    });
    setSelected(refreshed);
    setNote(refreshed.note || "");
    return refreshed;
  };

  const resetItemEditor = () => {
    setItemOpen(false);
    setEditingItem(null);
    setDeleteItemTarget(null);
    setItemForm(emptyItemForm);
  };

  const openDetail = (prescription: Prescription) => {
    setSelected(prescription);
    setCreating(false);
    setConfirmCancel(false);
    setNote(prescription.note || "");
    resetItemEditor();
  };

  const closeDetail = () => {
    setSelected(null);
    setCreating(false);
  };

  const startCreate = () => {
    setSelected(null);
    setCreating(true);
  };

  const dirtyNote = Boolean(selected) && note.trim() !== (selected?.note || "").trim();

  const createPrescription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await apiRequest<Prescription>(`/dashboard/medical-records/${createRecordId.trim()}/prescription`, {
        method: "POST",
        body: { note: createNote.trim() || null, items: [] },
      });
      setCreating(false);
      setSelected(created);
      setNote(created.note || "");
      setCreateRecordId("");
      setCreateNote("");
      setNotice("Đã tạo đơn thuốc");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đơn thuốc");
    } finally {
      setBusy(false);
    }
  };

  const updateNote = async () => {
    if (!editable || !selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Prescription>(`/dashboard/prescriptions/${selected.id}`, {
        method: "PATCH",
        body: { note: note.trim() || null },
      });
      setSelected(updated);
      setNote(updated.note || "");
      setNotice("Đã lưu ghi chú đơn");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được đơn thuốc");
    } finally {
      setBusy(false);
    }
  };

  const simpleAction = async (prescription: Prescription, path: string, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Prescription>(`/dashboard/prescriptions/${prescription.id}${path}`, { method: "PATCH" });
      setSelected(updated);
      setNote(updated.note || "");
      setConfirmCancel(false);
      resetItemEditor();
      setNotice(message);
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable || !selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Prescription>(
        editingItem ? `/dashboard/prescriptions/${selected.id}/items/${editingItem.id}` : `/dashboard/prescriptions/${selected.id}/items`,
        {
          method: editingItem ? "PATCH" : "POST",
          body: buildItemPayload(itemForm, editingItem ? editingItem.sortOrder : selected.items.length),
        },
      );
      setSelected(updated);
      resetItemEditor();
      setNotice(editingItem ? "Đã cập nhật thuốc" : "Đã thêm thuốc");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thuốc");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async () => {
    if (!selected || !editable || !deleteItemTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<PrescriptionItem>(`/dashboard/prescriptions/${selected.id}/items/${deleteItemTarget.id}`, { method: "DELETE" });
      await refreshSelectedPrescription(selected.id);
      setDeleteItemTarget(null);
      setNotice("Đã xoá thuốc");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được thuốc");
    } finally {
      setBusy(false);
    }
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  const draftCount = prescriptions.filter((item) => item.status === "DRAFT").length;
  const emptyDraft = prescriptions.filter((item) => item.status === "DRAFT" && item.items.length === 0).length;

  const columns: DsColumn<Prescription>[] = [
    {
      key: "code",
      header: "Đơn thuốc",
      cell: (row) => (
        <div>
          <strong className="ds-mono">{row.prescriptionCode}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.items.length} thuốc</div>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Người khám",
      cell: (row) => (
        <div>
          <strong>{row.patient.fullName}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.patient.phone || "-"}</div>
        </div>
      ),
    },
    {
      key: "record",
      header: "Hồ sơ",
      cell: (row) => (
        <div>
          <span className="ds-mono">{row.medicalRecord.recordCode}</span>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.medicalRecord.diagnosis || "Chưa có chẩn đoán"}</div>
        </div>
      ),
    },
    { key: "doctor", header: "Bác sĩ", cell: (row) => doctorName(row.doctor) },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={statusTone[row.status]}>{statusLabel[row.status]}</DsStatusPill> },
  ];

  const open = Boolean(selected) || creating;

  const list = (
    <DsPanel flush>
      <form onSubmit={applySearch} aria-label="Lọc đơn thuốc">
        <DsToolbar>
          {!isDoctor ? (
            <div style={{ minWidth: 160, flex: "1 1 180px" }}>
              <DsSelect
                aria-label="Lọc theo bác sĩ"
                value={doctorId}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả bác sĩ</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctorName(doctor)}
                  </option>
                ))}
              </DsSelect>
            </div>
          ) : null}
          <div style={{ minWidth: 150, flex: "1 1 170px" }}>
            <DsInput
              aria-label="Tìm đơn thuốc"
              value={prescriptionCode}
              onChange={(event) => {
                setPrescriptionCode(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ mã đơn, mã hồ sơ hoặc tên để lọc"
            />
          </div>
          {canEdit ? (
            <DsButton variant="primary" onClick={startCreate}>
              <Plus aria-hidden="true" />
              Tạo đơn
            </DsButton>
          ) : null}
        </DsToolbar>
      </form>
      <DsTabs
        label="Lọc đơn theo trạng thái"
        items={statusTabs}
        value={status}
        onChange={(id) => {
          setStatus(id);
          setPage(1);
        }}
      />
      {open ? (
        prescriptions.length ? (
          <div role="listbox" aria-label="Danh sách đơn thuốc">
            {prescriptions.map((prescription) => (
              <button
                key={prescription.id}
                type="button"
                role="option"
                className="ds-listrow"
                aria-selected={prescription.id === selected?.id}
                onClick={() => openDetail(prescription)}
              >
                <span className="ds-listrow__main">
                  <strong>{prescription.patient.fullName}</strong>
                  <small>
                    {prescription.prescriptionCode} · {prescription.items.length} thuốc
                  </small>
                </span>
                <DsStatusPill tone={statusTone[prescription.status]}>{statusLabel[prescription.status]}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có đơn thuốc phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách đơn thuốc"
          columns={columns}
          rows={prescriptions}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="Chưa có đơn thuốc phù hợp"
          emptyDescription="Đổi bộ lọc hoặc tạo đơn từ một hồ sơ khám."
          onRowClick={openDetail}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} đơn · trang {pagination.page}/{pagination.totalPages || 1}
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

  const createPane = creating ? (
    <DsPane title="Tạo đơn thuốc" onClose={closeDetail}>
      <form onSubmit={createPrescription} style={{ display: "grid", gap: 12 }} aria-label="Tạo đơn thuốc">
        <DsNotice tone="info">Hồ sơ phải thuộc ca đang khám hoặc đã hoàn thành và chưa có đơn thuốc. Cũng có thể tạo ngay từ trang Hồ sơ khám.</DsNotice>
        <DsField label="Mã hồ sơ hoặc mã định danh" htmlFor="create-record" required>
          <DsInput id="create-record" value={createRecordId} required onChange={(event) => setCreateRecordId(event.target.value)} />
        </DsField>
        <DsField label="Ghi chú đơn" htmlFor="create-note">
          <DsTextarea id="create-note" rows={2} value={createNote} onChange={(event) => setCreateNote(event.target.value)} />
        </DsField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <DsButton onClick={closeDetail}>Hủy</DsButton>
          <DsButton type="submit" variant="primary" disabled={busy}>
            {busy ? "Đang tạo..." : "Tạo đơn"}
          </DsButton>
        </div>
      </form>
    </DsPane>
  ) : null;

  const detailPane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.prescriptionCode} · ${selected.patient.fullName}`}
      badge={<DsStatusPill tone={statusTone[selected.status]}>{statusLabel[selected.status]}</DsStatusPill>}
      onClose={closeDetail}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {selected.patient.phone || "-"} · {selected.medicalRecord.recordCode} · {doctorName(selected.doctor)} · tạo {formatVietnamDateTime(selected.createdAt)}
        {selected.issuedAt ? ` · phát hành ${formatVietnamDateTime(selected.issuedAt)}` : ""}
        {selected.cancelledAt ? ` · huỷ ${formatVietnamDateTime(selected.cancelledAt)}` : ""}
      </div>

      <div className="ds-savebar" style={{ borderTop: 0, position: "static", paddingTop: 12 }}>
        {editable ? (
          <DsButton
            variant="primary"
            disabled={busy || selected.items.length === 0 || dirtyNote}
            title={selected.items.length === 0 ? "Cần thêm ít nhất 1 thuốc" : dirtyNote ? "Lưu ghi chú trước khi phát hành" : undefined}
            onClick={() => void simpleAction(selected, "/issue", "Đã phát hành đơn")}
          >
            Phát hành đơn
          </DsButton>
        ) : null}
        {selected.status === "ISSUED" ? (
          <>
            <PrintButton label="In đơn thuốc" />
            <PrintablePrescription prescription={selected} />
          </>
        ) : null}
        <Link href={`/dashboard/medical-records?recordCode=${encodeURIComponent(selected.medicalRecord.recordCode)}`} className="ds-btn">
          Mở hồ sơ khám
        </Link>
        <span style={{ flex: 1 }} />
        {canEdit && selected.status !== "CANCELLED" ? (
          confirmCancel ? (
            <>
              <span style={{ fontSize: 13 }}>Huỷ đơn này?</span>
              <DsButton variant="danger" disabled={busy} onClick={() => void simpleAction(selected, "/cancel", "Đã huỷ đơn thuốc")}>
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
      {editable && selected.items.length === 0 ? (
        <div style={{ padding: "0 16px" }}>
          <DsNotice tone="warn">Đơn chưa có thuốc. Thêm ít nhất 1 thuốc để phát hành.</DsNotice>
        </div>
      ) : null}

      <div className="ds-editor">
        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Thuốc trong đơn ({selected.items.length})</h3>
              {editable && !itemOpen ? (
                <DsButton
                  onClick={() => {
                    setEditingItem(null);
                    setDeleteItemTarget(null);
                    setItemForm(emptyItemForm);
                    setItemOpen(true);
                  }}
                >
                  Thêm thuốc
                </DsButton>
              ) : null}
            </div>
            {selected.items.length === 0 && !itemOpen ? (
              <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có thuốc.</p>
            ) : null}
            {selected.items.map((item) => (
              <div key={item.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>{item.medicineName}</strong>
                  <small>
                    {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ") || "Chưa có liều dùng"}
                    {" · "}
                    SL {item.quantity ?? "-"} {item.unit || ""}
                  </small>
                  {item.instruction ? <small>{item.instruction}</small> : null}
                  {deleteItemTarget?.id === item.id ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>Xoá thuốc này khỏi đơn?</span>
                      <DsButton variant="danger" disabled={busy} onClick={() => void deleteItem()}>
                        Xoá
                      </DsButton>
                      <DsButton onClick={() => setDeleteItemTarget(null)}>Giữ lại</DsButton>
                    </div>
                  ) : null}
                </div>
                {editable && deleteItemTarget?.id !== item.id ? (
                  <span style={{ display: "flex", gap: 4 }}>
                    <DsButton
                      variant="ghost"
                      onClick={() => {
                        setEditingItem(item);
                        setDeleteItemTarget(null);
                        setItemForm(toItemForm(item));
                        setItemOpen(true);
                      }}
                    >
                      Sửa
                    </DsButton>
                    <DsButton
                      variant="ghost"
                      onClick={() => {
                        setDeleteItemTarget(item);
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
                <DsField label="Tên thuốc" htmlFor="item-name" required>
                  <DsInput id="item-name" value={itemForm.medicineName} required onChange={(event) => setItemForm((current) => ({ ...current, medicineName: event.target.value }))} />
                </DsField>
                <div className="ds-grid-fields">
                  <DsField label="Liều dùng" htmlFor="item-dosage">
                    <DsInput id="item-dosage" value={itemForm.dosage} onChange={(event) => setItemForm((current) => ({ ...current, dosage: event.target.value }))} />
                  </DsField>
                  <DsField label="Tần suất" htmlFor="item-frequency">
                    <DsInput id="item-frequency" value={itemForm.frequency} onChange={(event) => setItemForm((current) => ({ ...current, frequency: event.target.value }))} />
                  </DsField>
                  <DsField label="Thời gian" htmlFor="item-duration">
                    <DsInput id="item-duration" value={itemForm.duration} onChange={(event) => setItemForm((current) => ({ ...current, duration: event.target.value }))} />
                  </DsField>
                  <DsField label="Số lượng" htmlFor="item-quantity">
                    <DsInput
                      id="item-quantity"
                      inputMode="numeric"
                      value={itemForm.quantity}
                      onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value.replace(/\D/g, "") }))}
                    />
                  </DsField>
                  <DsField label="Đơn vị" htmlFor="item-unit">
                    <DsInput id="item-unit" value={itemForm.unit} onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))} />
                  </DsField>
                </div>
                <DsField label="Hướng dẫn dùng thuốc" htmlFor="item-instruction">
                  <DsTextarea id="item-instruction" rows={2} value={itemForm.instruction} onChange={(event) => setItemForm((current) => ({ ...current, instruction: event.target.value }))} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={resetItemEditor}>Hủy</DsButton>
                  <DsButton type="submit" variant="primary" disabled={busy}>
                    {busy ? "Đang lưu..." : editingItem ? "Lưu thuốc" : "Thêm thuốc"}
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
              <DsTextarea aria-label="Ghi chú đơn" rows={3} value={note} disabled={!editable} onChange={(event) => setNote(event.target.value)} />
              {editable ? (
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  {dirtyNote ? <DsStatusPill tone="warn">Chưa lưu</DsStatusPill> : null}
                  <DsButton disabled={!dirtyNote || busy} onClick={() => setNote(selected.note || "")}>
                    Hủy thay đổi
                  </DsButton>
                  <DsButton variant="primary" disabled={!dirtyNote || busy} onClick={() => void updateNote()}>
                    Lưu ghi chú
                  </DsButton>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Trước khi phát hành</h3>
            </div>
            <div className="ds-card__body">
              <div className="ds-check">
                <span className={`ds-step__n${selected.items.length > 0 ? " is-done" : ""}`} aria-hidden="true">
                  {selected.items.length > 0 ? "✓" : "!"}
                </span>
                <strong>{selected.items.length > 0 ? `Có ${selected.items.length} thuốc` : "Chưa có thuốc"}</strong>
              </div>
              <div className="ds-check">
                <span
                  className={`ds-step__n${selected.items.length > 0 && selected.items.every((item) => item.dosage && item.quantity) ? " is-done" : ""}`}
                  aria-hidden="true"
                >
                  {selected.items.length > 0 && selected.items.every((item) => item.dosage && item.quantity) ? "✓" : "–"}
                </span>
                <div>
                  <strong>Liều dùng và số lượng đầy đủ</strong>
                  <small>Không bắt buộc, giúp dược sĩ cấp thuốc chính xác.</small>
                </div>
              </div>
              <p className="ds-hint" style={{ margin: 0 }}>
                Phát hành đơn sẽ gửi cho người khám và chuyển sang hàng đợi cấp thuốc. Đơn đã phát hành không sửa được.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Đơn thuốc"
        description={
          isDoctor
            ? `${draftCount} đơn nháp trong danh sách · ${emptyDraft} đơn chưa có thuốc`
            : "Tạo đơn từ hồ sơ khám, quản lý thuốc và theo dõi trạng thái phát hành"
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit wide list={list} pane={detailPane ?? createPane} />
    </>
  );
}

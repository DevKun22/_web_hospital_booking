"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest, apiUrl, uploadMedicalFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  fetchDashboardMedicalRecord,
  useDashboardMedicalRecord,
  useDashboardMedicalRecordDoctors,
  useDashboardMedicalRecords,
} from "@/lib/dashboard-medical-records-query";
import { formatVietnamDate, getVietnamDateInput } from "@/lib/date";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { DoctorProfile, LabResult, MedicalRecord, MedicalResultStatus } from "@/lib/types";

// Hồ sơ khám: danh sách bên trái; chọn một hồ sơ thì danh sách thu hẹp và khung làm việc chiếm phần còn lại
// (biểu mẫu chuyên môn, tệp kết quả, kết quả cận lâm sàng, việc cần làm trước khi công bố).

type RecordForm = {
  symptoms: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  doctorNotes: string;
  resultPdfUrl: string;
};

type LabForm = {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  conclusion: string;
  fileUrl: string;
};

const emptyRecordForm: RecordForm = { symptoms: "", diagnosis: "", treatment: "", prescription: "", doctorNotes: "", resultPdfUrl: "" };
const emptyLabForm: LabForm = { testName: "", resultValue: "", unit: "", referenceRange: "", conclusion: "", fileUrl: "" };

const statusLabel: Record<MedicalResultStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  ARCHIVED: "Đã lưu trữ",
};

const statusTone: Record<MedicalResultStatus, DsTone> = {
  DRAFT: "warn",
  PUBLISHED: "good",
  ARCHIVED: "neutral",
};

const doctorName = (doctor: DoctorProfile | MedicalRecord["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const toRecordForm = (record: MedicalRecord): RecordForm => ({
  symptoms: record.symptoms || "",
  diagnosis: record.diagnosis || "",
  treatment: record.treatment || "",
  prescription: record.prescription || "",
  doctorNotes: record.doctorNotes || "",
  resultPdfUrl: record.resultPdfUrl || "",
});

const toLabForm = (lab: LabResult): LabForm => ({
  testName: lab.testName,
  resultValue: lab.resultValue || "",
  unit: lab.unit || "",
  referenceRange: lab.referenceRange || "",
  conclusion: lab.conclusion || "",
  fileUrl: lab.fileUrl || "",
});

const buildRecordPayload = (form: RecordForm) => ({
  symptoms: form.symptoms.trim() || null,
  diagnosis: form.diagnosis.trim() || null,
  treatment: form.treatment.trim() || null,
  prescription: form.prescription.trim() || null,
  doctorNotes: form.doctorNotes.trim() || null,
  resultPdfUrl: form.resultPdfUrl.trim() || null,
});

const buildLabPayload = (form: LabForm) => ({
  testName: form.testName.trim(),
  resultValue: form.resultValue.trim() || null,
  unit: form.unit.trim() || null,
  referenceRange: form.referenceRange.trim() || null,
  conclusion: form.conclusion.trim() || null,
  fileUrl: form.fileUrl.trim() || null,
});

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "DRAFT", label: "Bản nháp" },
  { id: "PUBLISHED", label: "Đã công bố" },
  { id: "ARCHIVED", label: "Đã lưu trữ" },
];

const textFields: { key: keyof RecordForm; label: string; hint?: string; rows: number; internal?: boolean }[] = [
  { key: "symptoms", label: "Triệu chứng", rows: 3 },
  { key: "diagnosis", label: "Chẩn đoán", rows: 3 },
  { key: "treatment", label: "Hướng điều trị", rows: 3 },
  { key: "prescription", label: "Ghi chú đơn thuốc", hint: "Hiện cho người khám cùng đơn thuốc.", rows: 2 },
  { key: "doctorNotes", label: "Ghi chú của bác sĩ", hint: "Nội bộ: người khám không nhìn thấy.", rows: 2, internal: true },
];

// Vùng chọn hoặc kéo thả tệp, dùng cho tệp kết quả của hồ sơ và của từng kết quả cận lâm sàng.
function FileDrop({ inputId, busy, onFile }: { inputId: string; busy: boolean; onFile: (file: File | undefined) => void }) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`ds-drop${over ? " is-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFile(event.dataTransfer.files?.[0]);
      }}
    >
      {busy ? (
        "Đang tải tệp lên..."
      ) : (
        <>
          Kéo thả tệp vào đây hoặc <label htmlFor={inputId}>chọn từ máy</label>
          <input
            id={inputId}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="ds-hint" style={{ marginTop: 4 }}>
            PDF, JPG, PNG, WEBP · tối đa 10 MB · lưu riêng tư, người khám chỉ xem được sau khi công bố
          </div>
        </>
      )}
    </div>
  );
}

export default function MedicalRecordsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(getVietnamDateInput());
  const [recordCode, setRecordCode] = useState("");
  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const appliedRecordCode = useDebouncedValue(recordCode.trim());
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploadingRecordFile, setUploadingRecordFile] = useState(false);
  const [uploadingLabFile, setUploadingLabFile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSnapshot, setSelected] = useState<MedicalRecord | null>(null);
  const [recordForm, setRecordForm] = useState<RecordForm>(emptyRecordForm);
  const [labOpen, setLabOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<LabResult | null>(null);
  const [deleteLabTarget, setDeleteLabTarget] = useState<LabResult | null>(null);
  const [labForm, setLabForm] = useState<LabForm>(emptyLabForm);

  const canArchive = can(user, "record.archive");
  const isDoctor = user?.role === "DOCTOR";
  const canCreatePrescription = can(user, "prescription.write");
  const canEdit = can(user, "record.edit");

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      date: date || undefined,
      recordCode: appliedRecordCode || undefined,
      page,
      limit: 20,
    }),
    [appliedRecordCode, date, doctorId, isDoctor, page, status],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const recordsQuery = useDashboardMedicalRecords(query);
  const doctorsQuery = useDashboardMedicalRecordDoctors(doctorQuery, !isDoctor && can(user, "catalog.view"));
  const selectedRecordQuery = useDashboardMedicalRecord(selectedSnapshot?.id);
  const loading = recordsQuery.isLoading;
  const records = recordsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pagination = recordsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedRecordQuery.data ?? selectedSnapshot;
  const queryError = recordsQuery.error || doctorsQuery.error || selectedRecordQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu hồ sơ khám") : "";
  const visibleError = error || queryErrorMessage;

  useEffect(() => {
    const linkedRecordCode = searchParams.get("recordCode")?.trim().toUpperCase();
    if (!linkedRecordCode) return;

    const timeoutId = window.setTimeout(() => {
      setRecordCode(linkedRecordCode);
      setDate("");
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const invalidateMedicalRecords = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardPrescriptions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAppointments() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
    ]);
  };

  const refreshSelectedRecord = async (id: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: queryKeys.dashboardMedicalRecord(id),
      queryFn: () => fetchDashboardMedicalRecord(id),
    });
    setSelected(refreshed);
    setRecordForm(toRecordForm(refreshed));
    return refreshed;
  };

  const openDetail = (record: MedicalRecord) => {
    setSelected(record);
    setRecordForm(toRecordForm(record));
    setLabOpen(false);
    setEditingLab(null);
    setDeleteLabTarget(null);
    setLabForm(emptyLabForm);
  };

  const closeDetail = () => setSelected(null);

  const dirty = Boolean(selected) && JSON.stringify(recordForm) !== JSON.stringify(selected ? toRecordForm(selected) : emptyRecordForm);

  const saveRecord = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<MedicalRecord>(`/dashboard/medical-records/${selected.id}`, {
        method: "PATCH",
        body: buildRecordPayload(recordForm),
      });
      setSelected(updated);
      setRecordForm(toRecordForm(updated));
      setNotice("Đã lưu hồ sơ khám");
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được hồ sơ khám");
    } finally {
      setBusy(false);
    }
  };

  const uploadRecordResultFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingRecordFile(true);
    setError("");
    setNotice("");
    try {
      const asset = await uploadMedicalFile(file);
      setRecordForm((current) => ({ ...current, resultPdfUrl: asset.url }));
      setNotice("Đã tải tệp kết quả lên. Bấm Lưu hồ sơ để đính kèm.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tệp kết quả lên");
    } finally {
      setUploadingRecordFile(false);
    }
  };

  const uploadLabResultFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingLabFile(true);
    setError("");
    setNotice("");
    try {
      const asset = await uploadMedicalFile(file);
      setLabForm((current) => ({ ...current, fileUrl: asset.url }));
      setNotice("Đã tải tệp cận lâm sàng lên");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tệp cận lâm sàng lên");
    } finally {
      setUploadingLabFile(false);
    }
  };

  const simpleRecordAction = async (record: MedicalRecord, path: string, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<MedicalRecord>(`/dashboard/medical-records/${record.id}${path}`, { method: "PATCH" });
      setSelected(updated);
      setRecordForm(toRecordForm(updated));
      setNotice(message);
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  };

  const createPrescriptionFromRecord = async (record: MedicalRecord) => {
    if (!canCreatePrescription) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/dashboard/medical-records/${record.id}/prescription`, {
        method: "POST",
        body: { note: recordForm.prescription.trim() || recordForm.doctorNotes.trim() || null, items: [] },
      });
      await refreshSelectedRecord(record.id);
      setNotice("Đã tạo đơn thuốc nháp từ hồ sơ");
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đơn thuốc từ hồ sơ");
    } finally {
      setBusy(false);
    }
  };

  const saveLabResult = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editingLab) {
        await apiRequest<LabResult>(`/dashboard/medical-records/${selected.id}/lab-results/${editingLab.id}`, {
          method: "PATCH",
          body: buildLabPayload(labForm),
        });
        setNotice("Đã cập nhật kết quả cận lâm sàng");
      } else {
        await apiRequest<LabResult>(`/dashboard/medical-records/${selected.id}/lab-results`, {
          method: "POST",
          body: buildLabPayload(labForm),
        });
        setNotice("Đã thêm kết quả cận lâm sàng");
      }
      setEditingLab(null);
      setDeleteLabTarget(null);
      setLabOpen(false);
      setLabForm(emptyLabForm);
      await refreshSelectedRecord(selected.id);
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được kết quả cận lâm sàng");
    } finally {
      setBusy(false);
    }
  };

  const deleteLabResult = async () => {
    if (!selected || !deleteLabTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<LabResult>(`/dashboard/medical-records/${selected.id}/lab-results/${deleteLabTarget.id}`, { method: "DELETE" });
      setNotice("Đã xoá kết quả cận lâm sàng");
      setDeleteLabTarget(null);
      await refreshSelectedRecord(selected.id);
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được kết quả cận lâm sàng");
    } finally {
      setBusy(false);
    }
  };

  const applyRecordSearch = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  const draftCount = records.filter((record) => record.status === "DRAFT").length;
  const needPrescription = records.filter((record) => !record.prescriptionRecord && ["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)).length;

  const tableColumns: DsColumn<MedicalRecord>[] = [
    {
      key: "record",
      header: "Hồ sơ",
      cell: (row) => (
        <div>
          <strong className="ds-mono">{row.recordCode}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.labResults.length} kết quả cận lâm sàng</div>
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
      key: "appointment",
      header: "Lịch hẹn",
      cell: (row) => (
        <div>
          <span className="ds-mono">{row.appointment.bookingCode}</span>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{formatVietnamDate(row.appointment.appointmentDate)}</div>
        </div>
      ),
    },
    { key: "doctor", header: "Bác sĩ", cell: (row) => doctorName(row.doctor) },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={statusTone[row.status]}>{statusLabel[row.status]}</DsStatusPill> },
  ];

  const pager = (
    <div className="ds-pager">
      <span>
        {pagination.total} hồ sơ · trang {pagination.page}/{pagination.totalPages || 1}
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
  );

  const list = (
    <>
      <DsPanel flush>
        <form onSubmit={applyRecordSearch} aria-label="Lọc hồ sơ khám">
          <DsToolbar>
            <div style={{ minWidth: 150, flex: "0 1 160px" }}>
              <VietnamDateInput
                value={date}
                onChange={(value) => {
                  setDate(value);
                  setPage(1);
                }}
                ariaLabel="Ngày lọc hồ sơ khám"
                className="ds-input"
              />
            </div>
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
                aria-label="Mã hồ sơ"
                value={recordCode}
                onChange={(event) => {
                  setRecordCode(event.target.value);
                  setPage(1);
                }}
                placeholder="Gõ mã hồ sơ để lọc"
              />
            </div>
          </DsToolbar>
        </form>
        <DsTabs
          label="Lọc hồ sơ theo trạng thái"
          items={statusTabs}
          value={status}
          onChange={(id) => {
            setStatus(id);
            setPage(1);
          }}
        />
        {selected ? (
          records.length ? (
            <div role="listbox" aria-label="Danh sách hồ sơ">
              {records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  role="option"
                  className="ds-listrow"
                  aria-selected={record.id === selected.id}
                  onClick={() => openDetail(record)}
                >
                  <span className="ds-listrow__main">
                    <strong>{record.patient.fullName}</strong>
                    <small>{record.recordCode}</small>
                  </span>
                  <DsStatusPill tone={statusTone[record.status]}>{statusLabel[record.status]}</DsStatusPill>
                </button>
              ))}
            </div>
          ) : (
            <DsEmptyState title="Chưa có hồ sơ phù hợp" />
          )
        ) : (
          <DsDataTable
            caption="Danh sách hồ sơ khám"
            columns={tableColumns}
            rows={records}
            rowKey={(row) => row.id}
            loading={loading}
            emptyTitle="Chưa có hồ sơ phù hợp"
            emptyDescription="Đổi ngày hoặc bộ lọc để xem hồ sơ khác."
            onRowClick={openDetail}
          />
        )}
        {pager}
      </DsPanel>
    </>
  );

  const hasFile = Boolean(recordForm.resultPdfUrl);
  const savedFile = selected && selected.resultPdfUrl && recordForm.resultPdfUrl === selected.resultPdfUrl;

  const pane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.recordCode} · ${selected.patient.fullName}`}
      badge={<DsStatusPill tone={statusTone[selected.status]}>{statusLabel[selected.status]}</DsStatusPill>}
      onClose={closeDetail}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {selected.patient.phone || "-"} · {selected.appointment.bookingCode} · khám ngày {formatVietnamDate(selected.appointment.appointmentDate)} ·{" "}
        {doctorName(selected.doctor)} · {selected.doctor.department.name}
      </div>

      <div className="ds-savebar" style={{ borderTop: 0, position: "static", paddingTop: 12 }}>
        {selected.status !== "PUBLISHED" && canEdit ? (
          <DsButton variant="primary" disabled={busy} onClick={() => void simpleRecordAction(selected, "/publish", "Đã công bố kết quả cho người khám")}>
            Công bố cho người khám
          </DsButton>
        ) : null}
        {canCreatePrescription && !selected.prescriptionRecord ? (
          <DsButton disabled={busy} onClick={() => void createPrescriptionFromRecord(selected)}>
            Tạo đơn thuốc
          </DsButton>
        ) : null}
        {selected.prescriptionRecord ? (
          <Link href="/dashboard/prescriptions" className="ds-btn">
            Mở đơn thuốc
          </Link>
        ) : null}
        <span style={{ flex: 1 }} />
        {canArchive && selected.status !== "ARCHIVED" ? (
          <DsButton variant="ghost" disabled={busy} onClick={() => void simpleRecordAction(selected, "/archive", "Đã lưu trữ hồ sơ")}>
            Lưu trữ
          </DsButton>
        ) : null}
      </div>

      <div className="ds-editor">
        <form className="ds-editor__col" onSubmit={saveRecord} id="record-form" aria-label="Nội dung chuyên môn">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Nội dung chuyên môn</h3>
            </div>
            <div className="ds-card__body">
              {textFields.map((field) => (
                <DsField key={field.key} label={field.label} htmlFor={`rf-${field.key}`} hint={field.hint}>
                  <DsTextarea
                    id={`rf-${field.key}`}
                    rows={field.rows}
                    value={recordForm[field.key]}
                    disabled={!canEdit}
                    onChange={(event) => setRecordForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    aria-describedby={field.hint ? `rf-${field.key}-hint` : undefined}
                    style={field.internal ? { background: "var(--ds-sunken)" } : undefined}
                  />
                </DsField>
              ))}
            </div>
          </div>
        </form>

        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Tệp kết quả</h3>
              <DsStatusPill>Riêng tư</DsStatusPill>
            </div>
            <div className="ds-card__body">
              {hasFile ? (
                <div className="ds-file">
                  <div className="ds-file__text">
                    <strong>{savedFile ? "Tệp kết quả đã đính kèm" : "Tệp mới, chưa lưu"}</strong>
                    <small>{savedFile ? "Đã lưu trong hồ sơ" : "Bấm Lưu hồ sơ để đính kèm"}</small>
                  </div>
                  {savedFile && selected ? (
                    <a href={apiUrl(`/dashboard/medical-records/${selected.id}/file`)} target="_blank" rel="noopener" className="ds-link">
                      Mở
                    </a>
                  ) : null}
                  {canEdit ? (
                    <DsButton variant="ghost" onClick={() => setRecordForm((current) => ({ ...current, resultPdfUrl: "" }))}>
                      Gỡ
                    </DsButton>
                  ) : null}
                </div>
              ) : null}
              {canEdit ? <FileDrop inputId="record-file" busy={uploadingRecordFile} onFile={(file) => void uploadRecordResultFile(file)} /> : null}
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Kết quả cận lâm sàng</h3>
              {canEdit && !labOpen ? (
                <DsButton
                  onClick={() => {
                    setEditingLab(null);
                    setDeleteLabTarget(null);
                    setLabForm(emptyLabForm);
                    setLabOpen(true);
                  }}
                >
                  Thêm kết quả
                </DsButton>
              ) : null}
            </div>
            {selected.labResults.length === 0 && !labOpen ? (
              <p style={{ margin: 0, padding: "14px", color: "var(--ds-muted)" }}>Chưa có kết quả cận lâm sàng.</p>
            ) : null}
            {selected.labResults.map((lab) => (
              <div key={lab.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>{lab.testName}</strong>
                  <small>
                    {lab.resultValue || "-"} {lab.unit || ""}
                    {lab.referenceRange ? ` · tham chiếu ${lab.referenceRange}` : ""}
                  </small>
                  {lab.conclusion ? <small>{lab.conclusion}</small> : null}
                  {lab.fileUrl ? (
                    <a href={apiUrl(`/dashboard/medical-records/${selected.id}/lab-results/${lab.id}/file`)} target="_blank" rel="noopener" className="ds-link">
                      Mở tệp
                    </a>
                  ) : null}
                  {deleteLabTarget?.id === lab.id ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>Xoá kết quả này?</span>
                      <DsButton variant="danger" disabled={busy} onClick={() => void deleteLabResult()}>
                        Xoá
                      </DsButton>
                      <DsButton onClick={() => setDeleteLabTarget(null)}>Giữ lại</DsButton>
                    </div>
                  ) : null}
                </div>
                {canEdit && deleteLabTarget?.id !== lab.id ? (
                  <span style={{ display: "flex", gap: 4 }}>
                    <DsButton
                      variant="ghost"
                      onClick={() => {
                        setEditingLab(lab);
                        setDeleteLabTarget(null);
                        setLabForm(toLabForm(lab));
                        setLabOpen(true);
                      }}
                    >
                      Sửa
                    </DsButton>
                    <DsButton
                      variant="ghost"
                      onClick={() => {
                        setDeleteLabTarget(lab);
                        setEditingLab(null);
                        setLabOpen(false);
                      }}
                    >
                      Xoá
                    </DsButton>
                  </span>
                ) : null}
              </div>
            ))}
            {labOpen ? (
              <form className="ds-card__body" onSubmit={saveLabResult} style={{ borderTop: "1px solid var(--ds-line)" }} aria-label={editingLab ? "Sửa kết quả" : "Thêm kết quả"}>
                <DsField label="Tên xét nghiệm" htmlFor="lab-name" required>
                  <DsInput id="lab-name" value={labForm.testName} required onChange={(event) => setLabForm((current) => ({ ...current, testName: event.target.value }))} />
                </DsField>
                <div className="ds-grid-fields">
                  <DsField label="Giá trị" htmlFor="lab-value">
                    <DsInput id="lab-value" value={labForm.resultValue} onChange={(event) => setLabForm((current) => ({ ...current, resultValue: event.target.value }))} />
                  </DsField>
                  <DsField label="Đơn vị" htmlFor="lab-unit">
                    <DsInput id="lab-unit" value={labForm.unit} onChange={(event) => setLabForm((current) => ({ ...current, unit: event.target.value }))} />
                  </DsField>
                  <DsField label="Khoảng tham chiếu" htmlFor="lab-ref">
                    <DsInput id="lab-ref" value={labForm.referenceRange} onChange={(event) => setLabForm((current) => ({ ...current, referenceRange: event.target.value }))} />
                  </DsField>
                </div>
                <DsField label="Kết luận" htmlFor="lab-conclusion">
                  <DsTextarea id="lab-conclusion" rows={2} value={labForm.conclusion} onChange={(event) => setLabForm((current) => ({ ...current, conclusion: event.target.value }))} />
                </DsField>
                {labForm.fileUrl ? (
                  <div className="ds-file">
                    <div className="ds-file__text">
                      <strong>Đã có tệp đính kèm</strong>
                    </div>
                    <DsButton variant="ghost" onClick={() => setLabForm((current) => ({ ...current, fileUrl: "" }))}>
                      Gỡ
                    </DsButton>
                  </div>
                ) : null}
                <FileDrop inputId="lab-file" busy={uploadingLabFile} onFile={(file) => void uploadLabResultFile(file)} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton
                    onClick={() => {
                      setLabOpen(false);
                      setEditingLab(null);
                      setLabForm(emptyLabForm);
                    }}
                  >
                    Hủy
                  </DsButton>
                  <DsButton type="submit" variant="primary" disabled={busy || uploadingLabFile}>
                    {editingLab ? "Lưu kết quả" : "Thêm kết quả"}
                  </DsButton>
                </div>
              </form>
            ) : null}
          </div>

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Trước khi công bố</h3>
            </div>
            <div className="ds-card__body">
              <div className="ds-check">
                <span className={`ds-step__n${recordForm.diagnosis.trim() ? " is-done" : ""}`} aria-hidden="true">
                  {recordForm.diagnosis.trim() ? "✓" : "!"}
                </span>
                <div>
                  <strong>{recordForm.diagnosis.trim() ? "Có chẩn đoán" : "Chưa có chẩn đoán"}</strong>
                </div>
              </div>
              <div className="ds-check">
                <span className={`ds-step__n${hasFile || selected.labResults.length > 0 ? " is-done" : ""}`} aria-hidden="true">
                  {hasFile || selected.labResults.length > 0 ? "✓" : "–"}
                </span>
                <div>
                  <strong>{hasFile || selected.labResults.length > 0 ? "Có kết quả đính kèm" : "Chưa có kết quả đính kèm"}</strong>
                  <small>Không bắt buộc.</small>
                </div>
              </div>
              <div className="ds-check">
                <span className={`ds-step__n${selected.prescriptionRecord ? " is-done" : ""}`} aria-hidden="true">
                  {selected.prescriptionRecord ? "✓" : "–"}
                </span>
                <div>
                  <strong>{selected.prescriptionRecord ? "Đã có đơn thuốc" : "Chưa có đơn thuốc"}</strong>
                  <small>Có thể công bố trước, kê đơn sau.</small>
                </div>
              </div>
              <p className="ds-hint" style={{ margin: 0 }}>
                Công bố sẽ gửi thông báo cho người khám và mở hồ sơ cho họ xem.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="ds-savebar">
        <span className="ds-savebar__msg">{dirty ? <DsStatusPill tone="warn">Có thay đổi chưa lưu</DsStatusPill> : "Mọi thay đổi đã được lưu"}</span>
        <DsButton disabled={!dirty || busy} onClick={() => selected && setRecordForm(toRecordForm(selected))}>
          Hủy thay đổi
        </DsButton>
        <DsButton type="submit" form="record-form" variant="primary" disabled={!dirty || busy || uploadingRecordFile || !canEdit}>
          Lưu hồ sơ
        </DsButton>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Hồ sơ khám"
        description={
          isDoctor
            ? `${draftCount} hồ sơ nháp trong danh sách · ${needPrescription} hồ sơ chưa có đơn thuốc`
            : "Theo dõi chẩn đoán, điều trị và kết quả khám của người khám"
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit wide list={list} pane={pane} />
    </>
  );
}

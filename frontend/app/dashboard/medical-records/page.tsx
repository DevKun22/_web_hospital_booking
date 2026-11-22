"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
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
  useActionToast,
  useConfirm,
  DsNotice,
} from "@/components/ds";
import { confirmShortage } from "@/components/doctor/prescription-editor";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest, uploadMedicalFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  fetchDashboardMedicalRecord,
  useDashboardMedicalRecord,
  useDashboardMedicalRecordDoctors,
  useDashboardMedicalRecords,
} from "@/lib/dashboard-medical-records-query";
import { useDashboardPrescription } from "@/lib/dashboard-prescriptions-query";
import { formatVietnamDate, getVietnamDateInput } from "@/lib/date";
import { confirmCompleteWithoutConclusion } from "@/lib/exam-completion-guard";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { MedicalRecord } from "@/lib/types";
import { LabResultsCard } from "./lab-results-card";
import { PrescriptionSection } from "./prescription-section";
import { ResultFileCard } from "./result-file-card";
import {
  type RecordForm,
  emptyRecordForm,
  statusLabel,
  statusTone,
  doctorName,
  toRecordForm,
  buildRecordPayload,
  statusTabs,
  textFields,
} from "./record-model";

// Hồ sơ khám: danh sách bên trái; chọn một hồ sơ thì danh sách thu hẹp và khung làm việc chiếm phần còn lại
// (biểu mẫu chuyên môn, tệp kết quả, kết quả cận lâm sàng, việc cần làm trước khi công bố).

export default function MedicalRecordsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSnapshot, setSelected] = useState<MedicalRecord | null>(null);
  const [recordForm, setRecordForm] = useState<RecordForm>(emptyRecordForm);
  const [chosenPrescriptionId, setChosenPrescriptionId] = useState<string | undefined>(undefined);

  const canArchive = can(user, "record.archive");
  const isDoctor = user?.role === "DOCTOR";
  const canCreatePrescription = can(user, "prescription.write");
  const canEdit = can(user, "record.edit");

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      date: date || undefined,
      q: appliedRecordCode || undefined,
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
  // Đơn thuốc của hồ sơ đang mở, soạn ngay trong khung hồ sơ (không phải sang trang Đơn thuốc).
  // Một hồ sơ có thể có nhiều đơn (đơn chính và các đơn bổ sung): mặc định mở đơn nháp, không có thì mở đơn mới nhất.
  const prescriptions = selected?.prescriptions ?? [];
  const defaultPrescriptionId = prescriptions.find((item) => item.status === "DRAFT")?.id ?? prescriptions[prescriptions.length - 1]?.id;
  const activePrescriptionId = prescriptions.some((item) => item.id === chosenPrescriptionId) ? chosenPrescriptionId : defaultPrescriptionId;
  const hasDraftPrescription = prescriptions.some((item) => item.status === "DRAFT");
  // Không có quyền xem đơn thuốc: máy chủ đã bỏ đơn khỏi hồ sơ, giao diện không gọi API đơn thuốc (tránh 403 và banner lỗi vô cớ).
  const canViewPrescriptions = selected?.prescriptionAccess !== false;
  const prescriptionQuery = useDashboardPrescription(canViewPrescriptions ? activePrescriptionId : undefined);
  const prescription = prescriptionQuery.data ?? null;
  const queryError = recordsQuery.error || doctorsQuery.error || selectedRecordQuery.error || prescriptionQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu hồ sơ khám") : "";
  // Kết quả thao tác hiện thành thông báo nổi ngay chỗ đang làm việc (không nằm ở đầu trang).
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  // Mở từ liên kết (?recordCode=MÃ HỒ SƠ hoặc MÃ LỊCH): lọc đúng hồ sơ đó và mở sẵn khung làm việc.
  const linkedRecordCode = searchParams.get("recordCode")?.trim().toUpperCase() ?? "";
  const [openedLink, setOpenedLink] = useState("");
  useEffect(() => {
    if (!linkedRecordCode) return;

    const timeoutId = window.setTimeout(() => {
      setRecordCode(linkedRecordCode);
      setDate("");
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [linkedRecordCode]);

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
  };

  const closeDetail = () => setSelected(null);

  useEffect(() => {
    if (!linkedRecordCode || openedLink === linkedRecordCode) return;
    const match = records.find((record) => record.recordCode.toUpperCase() === linkedRecordCode || record.appointment.bookingCode.toUpperCase() === linkedRecordCode);
    if (!match) return;
    const timeoutId = window.setTimeout(() => {
      setOpenedLink(linkedRecordCode);
      openDetail(match);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  });

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

  const simpleRecordAction = async (record: MedicalRecord, path: string, message: string) => {
    // Cảnh báo mềm: hồ sơ chưa có chẩn đoán hoặc hướng điều trị thì hỏi lại trước khi gửi cho người khám.
    if (path === "/publish" && !record.diagnosis?.trim() && !record.treatment?.trim()) {
      const proceed = await confirm({
        title: "Công bố hồ sơ chưa có kết luận?",
        message: "Hồ sơ này chưa có chẩn đoán hoặc hướng điều trị (đã lưu). Người khám sẽ nhận thông báo \"Kết quả khám đã sẵn sàng\" với nội dung trống.",
        confirmLabel: "Vẫn công bố",
      });
      if (!proceed) return;
    }
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
      const created = await apiRequest<{ id: string }>(`/dashboard/medical-records/${record.id}/prescription`, {
        method: "POST",
        body: { note: null, items: [] },
      });
      setChosenPrescriptionId(created.id);
      await refreshSelectedRecord(record.id);
      setNotice(prescriptions.length > 0 ? "Đã tạo đơn bổ sung (bản nháp)" : "Đã tạo đơn thuốc nháp từ hồ sơ");
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đơn thuốc từ hồ sơ");
    } finally {
      setBusy(false);
    }
  };

  // "Kết thúc khám": lưu hồ sơ nếu có thay đổi, phát hành đơn nháp có thuốc, rồi hoàn thành lịch (hóa đơn tự tạo ở máy chủ).
  // Mỗi bước dùng lại API sẵn có; dừng ở bước nào lỗi thì các bước trước vẫn giữ nguyên và bấm lại để làm tiếp.
  const finishExam = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let record = selected;
      if (dirty) {
        record = await apiRequest<MedicalRecord>(`/dashboard/medical-records/${selected.id}`, { method: "PATCH", body: buildRecordPayload(recordForm) });
        setSelected(record);
        setRecordForm(toRecordForm(record));
      }
      if (prescription && prescription.status === "DRAFT" && prescription.items.length > 0) {
        const { proceed, acknowledgeShortage } = await confirmShortage(prescription, confirm);
        if (!proceed) return;
        await apiRequest(`/dashboard/prescriptions/${prescription.id}/issue`, { method: "PATCH", body: acknowledgeShortage ? { acknowledgeShortage: true } : undefined });
      }
      if (!record.diagnosis?.trim() && !record.treatment?.trim() && !(await confirmCompleteWithoutConclusion(record.appointment.bookingCode, confirm))) return;
      await apiRequest(`/dashboard/appointments/${record.appointment.id}/complete`, { method: "PATCH" });
      setNotice("Đã kết thúc khám. Hóa đơn được tạo tự động, người khám sẽ thấy kết quả sau khi thanh toán.");
      await Promise.all([refreshSelectedRecord(record.id), invalidateMedicalRecords()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kết thúc được ca khám");
      await invalidateMedicalRecords();
    } finally {
      setBusy(false);
    }
  };

  const reloadAfterLabChange = async () => {
    if (!selected) return;
    await refreshSelectedRecord(selected.id);
    await invalidateMedicalRecords();
  };

  const applyRecordSearch = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  const draftCount = records.filter((record) => record.status === "DRAFT").length;
  const needPrescription = records.filter((record) => !record.prescriptions?.length && ["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)).length;

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
                aria-label="Tìm hồ sơ khám"
                value={recordCode}
                onChange={(event) => {
                  setRecordCode(event.target.value);
                  setPage(1);
                }}
                placeholder="Gõ mã hồ sơ, mã lịch hoặc tên để lọc"
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
          <DsButton
            disabled={busy}
            title="Hồ sơ tự công bố khi hóa đơn đã thanh toán; bấm đây để công bố sớm hơn"
            onClick={() => void simpleRecordAction(selected, "/publish", "Đã công bố kết quả cho người khám")}
          >
            Công bố sớm
          </DsButton>
        ) : null}
        <span style={{ flex: 1 }} />
        {canArchive && selected.status !== "ARCHIVED" ? (
          <DsButton variant="ghost" loading={busy} onClick={() => void simpleRecordAction(selected, "/archive", "Đã lưu trữ hồ sơ")}>
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
          <ResultFileCard
            recordId={selected.id}
            hasFile={hasFile}
            saved={Boolean(savedFile)}
            canEdit={canEdit}
            uploading={uploadingRecordFile}
            onUpload={(file) => void uploadRecordResultFile(file)}
            onRemove={() => setRecordForm((current) => ({ ...current, resultPdfUrl: "" }))}
          />

          <LabResultsCard
            key={selected.id}
            recordId={selected.id}
            labResults={selected.labResults}
            canEdit={canEdit}
            onChanged={reloadAfterLabChange}
            onNotice={setNotice}
            onError={setError}
          />
        </div>
      </div>

      <PrescriptionSection
        record={selected}
        prescriptions={prescriptions}
        activePrescriptionId={activePrescriptionId}
        prescription={prescription}
        canView={canViewPrescriptions}
        canCreate={canCreatePrescription}
        hasDraft={hasDraftPrescription}
        busy={busy}
        onChoose={setChosenPrescriptionId}
        onCreate={() => void createPrescriptionFromRecord(selected)}
        onChanged={() => void refreshSelectedRecord(selected.id)}
      />

      <div className="ds-savebar">
        <span className="ds-savebar__msg">{dirty ? <DsStatusPill tone="warn">Có thay đổi chưa lưu</DsStatusPill> : "Mọi thay đổi đã được lưu"}</span>
        <DsButton disabled={!dirty || busy} onClick={() => selected && setRecordForm(toRecordForm(selected))}>
          Hủy thay đổi
        </DsButton>
        <DsButton type="submit" form="record-form" variant={selected.appointment.status === "IN_PROGRESS" ? "default" : "primary"} disabled={!dirty || busy || uploadingRecordFile || !canEdit}>
          Lưu hồ sơ
        </DsButton>
        {selected.appointment.status === "IN_PROGRESS" && canEdit && isDoctor ? (
          <DsButton variant="primary" loading={busy} disabled={uploadingRecordFile} onClick={() => void finishExam()}>
            Kết thúc khám
          </DsButton>
        ) : null}
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
      </div>
      {queryErrorMessage ? <DsNotice tone="bad">{queryErrorMessage}</DsNotice> : null}
      <DsSplit wide list={list} pane={pane} />
    </>
  );
}

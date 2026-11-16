"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsInput,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsToolbar,
  type DsColumn,
  type DsTone,
  useActionToast,
} from "@/components/ds";
import { PrescriptionEditor } from "@/components/doctor/prescription-editor";
import { useAuth } from "@/lib/auth";
import { useDashboardPrescription, useDashboardPrescriptionDoctors, useDashboardPrescriptions } from "@/lib/dashboard-prescriptions-query";
import { formatVietnamDateTime } from "@/lib/date";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { can } from "@/lib/permissions";
import type { DoctorProfile, Prescription, PrescriptionStatus } from "@/lib/types";

// Đơn thuốc: danh sách bên trái; chọn một đơn thì khung bên phải để soạn thuốc, kiểm tra và phát hành (trình soạn dùng
// chung với phần Đơn thuốc trong hồ sơ khám). Đơn mới được tạo từ hồ sơ khám, không gõ mã hồ sơ ở đây.

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

const doctorName = (doctor: DoctorProfile | Prescription["doctor"]) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [search, setSearch] = useState("");
  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const appliedSearch = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedSnapshot, setSelected] = useState<Prescription | null>(null);

  const canEdit = can(user, "prescription.write");
  const isDoctor = user?.role === "DOCTOR";

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      q: appliedSearch || undefined,
      page,
      limit: 20,
    }),
    [appliedSearch, doctorId, isDoctor, page, status],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const prescriptionsQuery = useDashboardPrescriptions(query);
  const doctorsQuery = useDashboardPrescriptionDoctors(doctorQuery, !isDoctor && can(user, "catalog.view"));
  const selectedPrescriptionQuery = useDashboardPrescription(selectedSnapshot?.id);
  const prescriptions = prescriptionsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pagination = prescriptionsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedPrescriptionQuery.data ?? selectedSnapshot;

  const queryError = prescriptionsQuery.error || doctorsQuery.error || selectedPrescriptionQuery.error;
  useActionToast({ error: queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu đơn thuốc") : "" });

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

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc đơn thuốc">
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
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ mã đơn, mã hồ sơ hoặc tên để lọc"
            />
          </div>
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
      {selected ? (
        prescriptions.length ? (
          <div role="listbox" aria-label="Danh sách đơn thuốc">
            {prescriptions.map((prescription) => (
              <button
                key={prescription.id}
                type="button"
                role="option"
                className="ds-listrow"
                aria-selected={prescription.id === selected.id}
                onClick={() => setSelected(prescription)}
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
          loading={prescriptionsQuery.isLoading}
          emptyTitle="Chưa có đơn thuốc phù hợp"
          emptyDescription="Đơn mới được tạo từ hồ sơ khám."
          onRowClick={setSelected}
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

  const detailPane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.prescriptionCode} · ${selected.patient.fullName}`}
      badge={<DsStatusPill tone={statusTone[selected.status]}>{statusLabel[selected.status]}</DsStatusPill>}
      onClose={() => setSelected(null)}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {selected.patient.phone || "-"} · {selected.medicalRecord.recordCode} · {doctorName(selected.doctor)} · tạo {formatVietnamDateTime(selected.createdAt)}
        {selected.issuedAt ? ` · phát hành ${formatVietnamDateTime(selected.issuedAt)}` : ""}
        {selected.cancelledAt ? ` · huỷ ${formatVietnamDateTime(selected.cancelledAt)}` : ""}
      </div>
      <PrescriptionEditor
        key={selected.id}
        prescription={selected}
        canEdit={canEdit}
        onChange={setSelected}
        extraActions={
          <Link href={`/dashboard/medical-records?recordCode=${encodeURIComponent(selected.medicalRecord.recordCode)}`} className="ds-btn">
            Mở hồ sơ khám
          </Link>
        }
      />
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Đơn thuốc"
        description={isDoctor ? `${draftCount} đơn nháp trong danh sách · ${emptyDraft} đơn chưa có thuốc` : "Quản lý thuốc trong đơn và theo dõi trạng thái phát hành"}
      />
      <DsSplit wide list={list} pane={detailPane} />
    </>
  );
}

"use client";

import type { ComponentProps } from "react";
import { DsButton, DsLoading, DsStatusPill } from "@/components/ds";
import { PrescriptionEditor } from "@/components/doctor/prescription-editor";
import type { MedicalRecord } from "@/lib/types";

// Phần đơn thuốc trong khung hồ sơ: chọn đơn (đơn chính, đơn bổ sung), soạn đơn đang mở và nút kê đơn mới. Chỉ hiển thị, trạng thái nằm ở trang cha.

type PrescriptionData = ComponentProps<typeof PrescriptionEditor>["prescription"];

export function PrescriptionSection({
  record,
  prescriptions,
  activePrescriptionId,
  prescription,
  canView,
  canCreate,
  hasDraft,
  busy,
  onChoose,
  onCreate,
  onChanged,
}: {
  record: MedicalRecord;
  prescriptions: NonNullable<MedicalRecord["prescriptions"]>;
  activePrescriptionId: string | undefined;
  prescription: PrescriptionData | null;
  canView: boolean;
  canCreate: boolean;
  hasDraft: boolean;
  busy: boolean;
  onChoose: (id: string) => void;
  onCreate: () => void;
  onChanged: () => void;
}) {
  if (!canCreate && prescriptions.length === 0 && canView) return null;

  return (
    <section aria-label="Đơn thuốc" style={{ borderTop: "1px solid var(--ds-line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 0", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Đơn thuốc</h3>
        {prescription ? (
          <DsStatusPill tone={prescription.status === "ISSUED" ? "good" : prescription.status === "CANCELLED" ? "bad" : "warn"}>
            {prescription.status === "ISSUED" ? "Đã phát hành" : prescription.status === "CANCELLED" ? "Đã huỷ" : "Bản nháp"}
          </DsStatusPill>
        ) : null}
      </div>
      {prescriptions.length > 1 ? (
        <div role="tablist" aria-label="Các đơn thuốc của hồ sơ" style={{ display: "flex", gap: 8, padding: "10px 16px 0", flexWrap: "wrap" }}>
          {prescriptions.map((item, index) => (
            <DsButton key={item.id} variant={item.id === activePrescriptionId ? "primary" : "default"} onClick={() => onChoose(item.id)} aria-pressed={item.id === activePrescriptionId}>
              {index === 0 ? "Đơn chính" : `Đơn bổ sung ${index}`}
              {item.status === "DRAFT" ? " (nháp)" : item.status === "CANCELLED" ? " (đã huỷ)" : ""}
            </DsButton>
          ))}
        </div>
      ) : null}
      {!canView ? (
        <p style={{ margin: 0, padding: 16, color: "var(--ds-muted)" }}>
          Bạn chưa được cấp quyền xem đơn thuốc nên nội dung đơn không hiển thị ở đây. Liên hệ quản trị nếu cần xử lý khiếu nại.
        </p>
      ) : null}
      {prescription ? (
        <PrescriptionEditor key={prescription.id} prescription={prescription} canEdit={canCreate} onChange={onChanged} />
      ) : activePrescriptionId ? (
        <DsLoading label="Đang tải đơn thuốc..." />
      ) : null}
      {canCreate && !hasDraft && record.status !== "ARCHIVED" && ["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status) ? (
        <div style={{ padding: 16 }}>
          <DsButton loading={busy} onClick={onCreate}>
            {prescriptions.length > 0 ? "Tạo đơn bổ sung" : "Kê đơn thuốc"}
          </DsButton>
          {prescriptions.length > 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ds-muted)" }}>
              Đơn đã phát hành không sửa được. Cần thêm thuốc thì tạo đơn bổ sung; tiền thuốc đơn bổ sung sau khi hóa đơn đã thu được tính thành hóa đơn phụ.
            </p>
          ) : null}
        </div>
      ) : prescriptions.length === 0 && canView ? (
        <p style={{ margin: 0, padding: 16, color: "var(--ds-muted)" }}>Chưa có đơn thuốc.</p>
      ) : null}
    </section>
  );
}

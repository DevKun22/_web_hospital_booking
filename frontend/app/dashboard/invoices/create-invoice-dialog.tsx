"use client";

import { FormEvent, useState } from "react";
import {
  DsButton,
  DsEditDialog,
  DsField,
  DsInput,
  DsKeyValue,
  DsNotice,
  DsStatusPill,
} from "@/components/ds";
import { ApiError, apiRequest } from "@/lib/api";
import { useDashboardAppointments } from "@/lib/dashboard-appointments-query";
import { formatCurrency } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { InsuranceFields } from "./insurance-fields";
import {
  appointmentDoctorName,
  buildInsurancePayload,
  calculateInsuranceDiscount,
  defaultInsuranceForm,
  type InsuranceForm,
} from "./invoice-model";

// Hộp thoại tạo hóa đơn từ mã lịch hẹn. Giữ trạng thái riêng (mã lịch, BHYT, tra cứu lịch) nên mở lần mới luôn sạch,
// trang chỉ cần biết hóa đơn nào vừa được phát hành hoặc đã tồn tại.

export function CreateInvoiceDialog({
  initialCode,
  canUse,
  onClose,
  onIssued,
  onShowInvoiceCode,
  invalidate,
  onError,
}: {
  initialCode: string;
  canUse: boolean;
  onClose: () => void;
  onIssued: (invoice: Invoice, message: string) => void;
  onShowInvoiceCode: (code: string) => void;
  invalidate: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [appointmentId, setAppointmentId] = useState(initialCode);
  const [insuranceForm, setInsuranceForm] = useState<InsuranceForm>(defaultInsuranceForm);
  const [busy, setBusy] = useState(false);

  // Mã lịch tự tra sau khi ngừng gõ.
  const normalizedCode = appointmentId.trim().toUpperCase();
  const lookupKey = useDebouncedValue(normalizedCode);
  const previewQuery = useDashboardAppointments(
    { bookingCode: lookupKey || undefined, page: 1, limit: 1 },
    Boolean(lookupKey) && canUse,
  );
  const preview = previewQuery.data?.items[0] ?? null;
  const readyForInvoice = Boolean(preview && preview.status === "COMPLETED" && !preview.invoice);
  const previewSettled = Boolean(lookupKey) && lookupKey === normalizedCode && !previewQuery.isFetching;
  const discount = calculateInsuranceDiscount(insuranceForm);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUse) return;
    setBusy(true);
    try {
      const invoice = await apiRequest<Invoice>(`/dashboard/invoices/appointments/${normalizedCode}`, {
        method: "POST",
        body: buildInsurancePayload(insuranceForm),
      });
      onIssued(invoice, "Đã phát hành hóa đơn");
      await invalidate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Hóa đơn vừa được phát hành ở thao tác khác: mở hóa đơn hiện có thay vì báo lỗi.
        try {
          const refreshed = await previewQuery.refetch();
          const existingInvoiceId = refreshed.data?.items[0]?.invoice?.id;
          await invalidate();
          if (existingInvoiceId) {
            const existing = await apiRequest<Invoice>(`/dashboard/invoices/${existingInvoiceId}`);
            onIssued(existing, "Hóa đơn đã được phát hành ở một thao tác khác. Đã mở hóa đơn hiện có.");
            return;
          }
        } catch (recoveryError) {
          onError(recoveryError instanceof Error ? recoveryError.message : "Hóa đơn đã được phát hành nhưng chưa thể tải lại dữ liệu");
          return;
        }
      }
      onError(err instanceof Error ? err.message : "Không tạo được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsEditDialog size="lg" title="Tạo hóa đơn" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }} aria-label="Tạo hóa đơn">
        <DsField label="Mã lịch hẹn" htmlFor="create-appointment" hint="Lịch phải ở trạng thái hoàn thành khám và chưa có hóa đơn">
          <DsInput
            id="create-appointment"
            value={appointmentId}
            placeholder="Ví dụ: HB-8492"
            required
            onChange={(event) => setAppointmentId(event.target.value)}
          />
        </DsField>
        {lookupKey && previewQuery.isFetching ? <p className="ds-hint">Đang kiểm tra lịch hẹn...</p> : null}
        {previewQuery.error ? (
          <DsNotice tone="bad">{previewQuery.error instanceof Error ? previewQuery.error.message : "Không tải được lịch hẹn"}</DsNotice>
        ) : null}
        {previewSettled ? (
          preview ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>{preview.patientName}</h3>
                <DsStatusPill tone={readyForInvoice ? "good" : "warn"}>
                  {preview.invoice ? "Đã có hóa đơn" : preview.status === "COMPLETED" ? "Sẵn sàng phát hành" : "Chưa hoàn tất khám"}
                </DsStatusPill>
              </div>
              <div className="ds-card__body">
                <DsKeyValue
                  items={[
                    { label: "Lịch hẹn", value: `${preview.bookingCode} · ${preview.patientPhone}` },
                    { label: "Dịch vụ", value: preview.package?.name || preview.department.name },
                    { label: "Bác sĩ", value: appointmentDoctorName(preview) },
                    { label: "Giá khám", value: formatCurrency(preview.estimatedPrice) },
                    { label: "Phí dịch vụ", value: formatCurrency(preview.serviceFee) },
                    { label: "BHYT", value: preview.hasBHYT ? preview.healthInsuranceCode || "Có đăng ký BHYT" : "Không sử dụng" },
                    { label: "Tổng trước giảm trừ", value: <strong>{formatCurrency(preview.estimatedPrice + preview.serviceFee)}</strong> },
                  ]}
                />
                {preview.invoice ? (
                  <DsButton onClick={() => onShowInvoiceCode(preview.invoice?.invoiceCode || "")}>
                    Mở hóa đơn {preview.invoice.invoiceCode}
                  </DsButton>
                ) : null}
              </div>
            </div>
          ) : (
            <DsNotice tone="bad">Không tìm thấy lịch hẹn có mã {lookupKey}. Hãy kiểm tra lại mã lịch.</DsNotice>
          )
        ) : null}
        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Tính BHYT</h3>
          </div>
          <div className="ds-card__body">
            <p className="ds-hint" style={{ margin: 0 }}>
              Nhập phần tiền đủ điều kiện BHYT và mức hưởng, hệ thống tự tính giảm trừ.
            </p>
            <InsuranceFields idPrefix="create" form={insuranceForm} onChange={setInsuranceForm} />
            <DsKeyValue items={[{ label: "Giảm BHYT dự kiến", value: <strong>{formatCurrency(discount)}</strong> }]} />
          </div>
        </div>
        <div className="ds-form-actions" style={{ alignItems: "center" }}>
          {!readyForInvoice ? <span className="ds-hint">Cần một lịch hẹn đã hoàn thành khám và chưa có hóa đơn.</span> : null}
          <DsButton onClick={onClose}>Hủy</DsButton>
          <DsButton type="submit" variant="primary" disabled={busy || !readyForInvoice}>
            {busy ? "Đang phát hành..." : "Phát hành hóa đơn"}
          </DsButton>
        </div>
      </form>
    </DsEditDialog>
  );
}

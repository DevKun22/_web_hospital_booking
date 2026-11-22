"use client";

import { useState } from "react";
import { DsButton, DsDialog, DsField, DsInput, DsKeyValue, DsNotice, DsSelect, DsTextarea, useConfirm } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Invoice, PaymentMethod } from "@/lib/types";
import { InsuranceFields } from "./insurance-fields";
import {
  buildInsuranceForm,
  buildInsurancePayload,
  calculateInsuranceDiscount,
  manualPayments,
  type InsuranceForm,
} from "./invoice-model";

// Các hộp thoại thao tác trên một hóa đơn: thu tại quầy, hủy, chỉnh giảm BHYT, hoàn tiền. Mỗi hộp giữ trạng thái nhập riêng và chỉ gắn khi mở,
// nên luôn bắt đầu sạch. Gọi máy chủ xong thì báo cho trang qua onDone (trang cập nhật hóa đơn đang xem và làm mới danh sách).

type ActionProps = {
  invoice: Invoice;
  onClose: () => void;
  onDone: (updated: Invoice, message: string) => Promise<void>;
  onError: (message: string) => void;
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function PayInvoiceDialog({ invoice, onClose, onDone, onError }: ActionProps) {
  const [method, setMethod] = useState<Exclude<PaymentMethod, "VNPAY">>("CASH");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (["CARD", "BANK_TRANSFER"].includes(method) && reference.trim().length < 3) {
      onError("Vui lòng nhập mã tham chiếu của giao dịch");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${invoice.id}/pay`, {
        method: "PATCH",
        body: { paymentMethod: method, paymentReference: reference.trim() || null },
      });
      await onDone(updated, "Đã thanh toán hóa đơn");
    } catch (err) {
      onError(errorText(err, "Không thanh toán được hóa đơn"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Ghi nhận thu tại quầy"
      description="Chỉ xác nhận sau khi nhân viên đã thực nhận tiền. VNPay được hệ thống tự ghi nhận qua cổng thanh toán."
      size="md"
      footer={
        <>
          <DsButton onClick={onClose}>Đóng</DsButton>
          <DsButton variant="primary" loading={busy} onClick={() => void submit()}>
            Xác nhận đã thu
          </DsButton>
        </>
      }
    >
      {invoice.paymentTransactions.some((transaction) => transaction.status === "PENDING") ? (
        <DsNotice tone="warn">
          Có giao dịch trực tuyến đang chờ hoặc chưa đồng bộ hết hạn. Máy chủ sẽ kiểm tra lại và chặn thu tại quầy nếu giao dịch còn hiệu lực để tránh thu hai lần.
        </DsNotice>
      ) : null}
      <DsField label="Phương thức" htmlFor="pay-method">
        <DsSelect id="pay-method" value={method} onChange={(event) => setMethod(event.target.value as Exclude<PaymentMethod, "VNPAY">)}>
          {manualPayments.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </DsSelect>
      </DsField>
      {method !== "CASH" ? (
        <DsField label="Mã tham chiếu" htmlFor="pay-reference" required={method === "CARD" || method === "BANK_TRANSFER"}>
          <DsInput id="pay-reference" value={reference} maxLength={100} placeholder="Mã giao dịch trên POS hoặc ngân hàng" onChange={(event) => setReference(event.target.value)} />
        </DsField>
      ) : null}
      <DsKeyValue items={[{ label: "Số tiền cần thu", value: <strong>{formatCurrency(invoice.finalAmount)}</strong> }]} />
    </DsDialog>
  );
}

export function CancelInvoiceDialog({ invoice, onClose, onDone, onError }: ActionProps) {
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    onError("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${invoice.id}/cancel`, { method: "PATCH" });
      await onDone(updated, "Đã hủy hóa đơn");
    } catch (err) {
      onError(errorText(err, "Không hủy được hóa đơn"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Xác nhận hủy hóa đơn"
      description="Hóa đơn chưa thanh toán sẽ chuyển sang trạng thái đã hủy; có thể chỉnh và mở lại sau."
      size="sm"
      footer={
        <>
          <DsButton onClick={onClose}>Giữ hóa đơn</DsButton>
          <DsButton variant="danger" loading={busy} onClick={() => void submit()}>
            Xác nhận hủy
          </DsButton>
        </>
      }
    />
  );
}

export function AdjustInvoiceDialog({ invoice, onClose, onDone, onError }: ActionProps) {
  const [form, setForm] = useState<InsuranceForm>(() => buildInsuranceForm(invoice));
  const [busy, setBusy] = useState(false);
  const discount = calculateInsuranceDiscount(form);
  const tooMuch = discount > invoice.totalAmount;
  const finalAmount = Math.max(invoice.totalAmount - discount, 0);

  const submit = async () => {
    if (tooMuch) {
      onError("Giảm trừ BHYT không được lớn hơn tổng tiền");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${invoice.id}`, { method: "PATCH", body: buildInsurancePayload(form) });
      await onDone(updated, invoice.status === "CANCELLED" ? "Đã điều chỉnh và mở lại hóa đơn" : "Đã điều chỉnh hóa đơn");
    } catch (err) {
      onError(errorText(err, "Không điều chỉnh được hóa đơn"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={invoice.status === "CANCELLED" ? "Chỉnh và mở lại hóa đơn" : "Chỉnh giảm BHYT"}
      description="Chỉ áp dụng cho hóa đơn chưa thanh toán. Nếu hóa đơn đang bị hủy, lưu điều chỉnh sẽ đưa hóa đơn về trạng thái chưa thanh toán."
      size="lg"
      footer={
        <>
          <DsButton onClick={onClose}>Đóng</DsButton>
          <DsButton variant="primary" disabled={busy || tooMuch} onClick={() => void submit()}>
            Lưu điều chỉnh
          </DsButton>
        </>
      }
    >
      <InsuranceFields idPrefix="adjust" form={form} onChange={setForm} />
      <DsKeyValue
        items={[
          { label: "Tổng tiền", value: formatCurrency(invoice.totalAmount) },
          { label: "Giảm BHYT mới", value: formatCurrency(discount) },
          { label: "Cần thu mới", value: <strong>{formatCurrency(finalAmount)}</strong> },
        ]}
      />
      {tooMuch ? <DsNotice tone="bad">Giảm trừ BHYT không được lớn hơn tổng tiền.</DsNotice> : null}
    </DsDialog>
  );
}

export function RefundInvoiceDialog({ invoice, onClose, onDone, onError }: ActionProps) {
  const confirm = useConfirm();
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const isVnpay = invoice.paymentMethod === "VNPAY";

  const submit = async () => {
    if (reason.trim().length < 5) {
      onError("Lý do hoàn tiền phải có ít nhất 5 ký tự");
      return;
    }
    if (isVnpay && reference.trim().length < 3) {
      onError("Vui lòng nhập mã tham chiếu do cổng thanh toán trả về");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${invoice.id}/refund`, {
        method: "PATCH",
        body: { refundReason: reason.trim(), refundReference: reference.trim() || null },
      });
      await onDone(updated, "Đã hoàn tiền hóa đơn");
    } catch (err) {
      onError(errorText(err, "Không hoàn tiền được hóa đơn"));
    } finally {
      setBusy(false);
    }
  };

  // Hoàn tiền toàn phần tự động qua API VNPay; chỉ dùng cho hóa đơn đã trả bằng VNPay.
  const submitViaVnpay = async () => {
    if (reason.trim().length < 5) {
      onError("Lý do hoàn tiền phải có ít nhất 5 ký tự");
      return;
    }
    const agreed = await confirm({
      title: `Hoàn ${invoice.finalAmount.toLocaleString("vi-VN")} đ qua VNPay?`,
      message: "Yêu cầu hoàn tiền được gửi ngay tới VNPay. Thao tác không thể hoàn tác.",
      confirmLabel: "Gửi yêu cầu hoàn",
      tone: "danger",
    });
    if (!agreed) return;
    setBusy(true);
    onError("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${invoice.id}/refund/vnpay`, { method: "POST", body: { refundReason: reason.trim() } });
      await onDone(updated, "Đã gửi yêu cầu hoàn tiền tới VNPay");
    } catch (err) {
      onError(errorText(err, "Không hoàn tiền được qua VNPay"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Xác nhận hoàn tiền"
      size="md"
      footer={
        <>
          <DsButton onClick={onClose}>Đóng</DsButton>
          {isVnpay ? (
            <DsButton variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => void submitViaVnpay()}>
              Hoàn tự động qua VNPay
            </DsButton>
          ) : null}
          <DsButton variant="primary" loading={busy} onClick={() => void submit()}>
            Hoàn tiền
          </DsButton>
        </>
      }
    >
      <DsField label="Lý do hoàn tiền" htmlFor="refund-reason" required hint="Ít nhất 5 ký tự">
        <DsTextarea id="refund-reason" rows={3} value={reason} placeholder="Ví dụ: người khám yêu cầu hoàn tiền" onChange={(event) => setReason(event.target.value)} />
      </DsField>
      <DsField label="Mã tham chiếu hoàn tiền" htmlFor="refund-reference" required={isVnpay}>
        <DsInput id="refund-reference" value={reference} maxLength={100} placeholder="Mã hoàn tiền từ quầy hoặc cổng thanh toán" onChange={(event) => setReference(event.target.value)} />
      </DsField>
      {isVnpay ? (
        <DsNotice tone="warn">
          Dùng nút &quot;Hoàn tự động qua VNPay&quot; để hệ thống gửi yêu cầu hoàn toàn phần tới VNPay. Nếu đã hoàn trực tiếp trên cổng VNPay (hoặc hệ thống báo chưa xác nhận được kết quả), hãy nhập mã tham chiếu rồi bấm &quot;Hoàn tiền&quot; để chỉ đồng bộ trạng thái.
        </DsNotice>
      ) : null}
    </DsDialog>
  );
}

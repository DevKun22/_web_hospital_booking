"use client";

import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsNotice, useToast } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

type RefundableMedicine = {
  status: string;
  paymentMethod: PaymentMethod | null;
  refundedAmount: number;
  total: number;
  lines: Array<{ id: string; description: string; amount: number; reason: "OUTSIDE" | "OUT_OF_STOCK" }>;
};

const reasonLabel = { OUTSIDE: "Người khám tự mua", OUT_OF_STOCK: "Kho hết hàng" } as const;

// Hóa đơn đã thanh toán mà có thuốc không được cấp (kho hết hàng hoặc người khám tự mua): hiện các dòng cần hoàn
// và cho ghi nhận đã hoàn. Tiền được hoàn ở cổng thanh toán hoặc tiền mặt; hệ thống chỉ ghi nhận để đối soát.
export function MedicineRefundPanel({ invoiceId, onChanged }: { invoiceId: string; onChanged: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const query = useQuery({
    queryKey: ["dashboard", "invoices", invoiceId, "medicine-refund"],
    queryFn: () => apiRequest<RefundableMedicine>(`/dashboard/invoices/${invoiceId}/medicine-refund`),
  });
  const data = query.data;
  if (!data) return null;
  if (data.total <= 0 && data.refundedAmount <= 0) return null;
  const needsReference = data.paymentMethod === "VNPAY";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await apiRequest<{ total: number }>(`/dashboard/invoices/${invoiceId}/medicine-refund`, {
        method: "POST",
        body: { refundReference: reference.trim() || null, note: note.trim() || null },
      });
      toast.success(`Đã ghi nhận hoàn ${formatCurrency(result.total)} tiền thuốc.`);
      setReference("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "invoices"] });
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không ghi nhận được hoàn tiền thuốc");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      {data.refundedAmount > 0 ? (
        <DsNotice tone="info">Đã hoàn một phần tiền thuốc: {formatCurrency(data.refundedAmount)}.</DsNotice>
      ) : null}
      {data.total > 0 ? (
        <form onSubmit={submit} aria-label="Hoàn tiền thuốc không được cấp" style={{ display: "grid", gap: 8 }}>
          <DsNotice tone="warn">
            <strong>Thuốc không được cấp, cần hoàn {formatCurrency(data.total)}:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {data.lines.map((line) => (
                <li key={line.id}>
                  {line.description} · {formatCurrency(line.amount)} · {reasonLabel[line.reason]}
                </li>
              ))}
            </ul>
            <span style={{ display: "block", marginTop: 6 }}>
              Hãy hoàn tiền cho người khám {needsReference ? "trên cổng quản trị VNPAY" : "(tiền mặt hoặc chuyển khoản)"} rồi ghi nhận ở đây. Hệ thống không tự chuyển tiền.
            </span>
          </DsNotice>
          <DsField
            label={needsReference ? "Mã tham chiếu hoàn tiền" : "Mã tham chiếu (không bắt buộc)"}
            htmlFor="medicine-refund-reference"
            required={needsReference}
          >
            <DsInput id="medicine-refund-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </DsField>
          <DsField label="Ghi chú (không bắt buộc)" htmlFor="medicine-refund-note">
            <DsInput id="medicine-refund-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </DsField>
          <div>
            <DsButton type="submit" variant="primary" disabled={busy || (needsReference && !reference.trim())}>
              {busy ? "Đang ghi nhận..." : "Ghi nhận đã hoàn tiền thuốc"}
            </DsButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

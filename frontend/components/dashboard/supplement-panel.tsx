"use client";

import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsNotice, DsSelect } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { formatVietnamDateTime } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { Invoice, PaymentMethod } from "@/lib/types";

type Supplement = NonNullable<Invoice["supplements"]>[number];

const methods: { value: Exclude<PaymentMethod, "VNPAY">; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "CARD", label: "Thẻ" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "OTHER", label: "Khác" },
];

const methodLabel = (method: PaymentMethod | null) => methods.find((item) => item.value === method)?.label ?? method ?? "-";

// Hóa đơn bổ sung tiền thuốc: đơn phát hành sau khi hóa đơn chính đã thanh toán. Thu tại quầy; dược sĩ chỉ cấp thuốc
// khi hóa đơn bổ sung đã thu.
export function SupplementPanel({
  invoiceId,
  supplements,
  canCollect,
  onChanged,
}: {
  invoiceId: string;
  supplements: Supplement[];
  canCollect: boolean;
  onChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<Exclude<PaymentMethod, "VNPAY">>("CASH");
  const [reference, setReference] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  if (supplements.length === 0) return null;
  const needsReference = method === "CARD" || method === "BANK_TRANSFER";

  const pay = async (event: FormEvent<HTMLFormElement>, supplement: Supplement) => {
    event.preventDefault();
    setBusyId(supplement.id);
    setError("");
    setDone("");
    try {
      await apiRequest(`/dashboard/invoices/${invoiceId}/supplements/${supplement.id}/pay`, {
        method: "PATCH",
        body: { paymentMethod: method, paymentReference: reference.trim() || null },
      });
      setDone(`Đã thu ${formatCurrency(supplement.amount)} hóa đơn bổ sung ${supplement.supplementCode}.`);
      setReference("");
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "invoices"] });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thu được hóa đơn bổ sung");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      {done ? <DsNotice tone="good">{done}</DsNotice> : null}
      {supplements.map((supplement) => (
        <div key={supplement.id} className="ds-card">
          <div className="ds-card__head">
            <h3>
              Hóa đơn bổ sung tiền thuốc {supplement.supplementCode} · {formatCurrency(supplement.amount)}
            </h3>
          </div>
          <div className="ds-card__body" style={{ display: "grid", gap: 8 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {supplement.items.map((item) => (
                <li key={item.id}>
                  {item.description} · {item.quantity} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.amount)}
                </li>
              ))}
            </ul>
            {supplement.status === "PAID" ? (
              <DsNotice tone="good">
                Đã thu {supplement.paidAt ? formatVietnamDateTime(supplement.paidAt) : ""} · {methodLabel(supplement.paymentMethod)}
                {supplement.paymentReference ? ` · ${supplement.paymentReference}` : ""}
              </DsNotice>
            ) : canCollect ? (
              <form onSubmit={(event) => void pay(event, supplement)} aria-label={`Thu hóa đơn bổ sung ${supplement.supplementCode}`} style={{ display: "grid", gap: 8 }}>
                <DsNotice tone="warn">Chưa thu. Dược sĩ chỉ cấp phần thuốc này sau khi hóa đơn bổ sung được thu.</DsNotice>
                <DsField label="Phương thức thu" htmlFor={`supplement-method-${supplement.id}`}>
                  <DsSelect
                    id={`supplement-method-${supplement.id}`}
                    value={method}
                    onChange={(event) => setMethod(event.target.value as Exclude<PaymentMethod, "VNPAY">)}
                  >
                    {methods.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </DsSelect>
                </DsField>
                {needsReference ? (
                  <DsField label="Mã tham chiếu" htmlFor={`supplement-reference-${supplement.id}`} required>
                    <DsInput id={`supplement-reference-${supplement.id}`} value={reference} onChange={(event) => setReference(event.target.value)} />
                  </DsField>
                ) : null}
                {error ? <DsNotice tone="bad">{error}</DsNotice> : null}
                <div>
                  <DsButton type="submit" variant="primary" disabled={busyId === supplement.id || (needsReference && !reference.trim())}>
                    {busyId === supplement.id ? "Đang ghi nhận..." : `Ghi nhận thu ${formatCurrency(supplement.amount)}`}
                  </DsButton>
                </div>
              </form>
            ) : (
              <DsNotice tone="warn">Chưa thu. Cần nhân viên có quyền thu tiền xử lý.</DsNotice>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { DsKeyValue, DsStatusPill } from "@/components/ds";
import { MedicineRefundPanel } from "@/components/dashboard/medicine-refund-panel";
import { SupplementPanel } from "@/components/dashboard/supplement-panel";
import { formatVietnamDateTime } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { insuranceRouteLabel, paymentLabel, transactionStatusLabel, transactionTone } from "./invoice-model";

// Nội dung chỉ đọc của khung chi tiết hóa đơn: khoản thu, tiêu chuẩn BHYT, thông tin thanh toán và các giao dịch trực tuyến.

export function InvoiceDetailCards({
  invoice,
  canRefund,
  canCollect,
  onChanged,
}: {
  invoice: Invoice;
  canRefund: boolean;
  canCollect: boolean;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="ds-editor">
      <div className="ds-editor__col">
        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Chi tiết khoản thu</h3>
          </div>
          <div className="ds-card__body">
            {invoice.items?.length ? (
              invoice.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{item.description}</strong>
                    {item.quantity > 1 ? (
                      <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </div>
                    ) : null}
                  </div>
                  <strong style={{ flex: "none" }}>{formatCurrency(item.amount)}</strong>
                </div>
              ))
            ) : (
              <p className="ds-hint" style={{ margin: 0 }}>
                Hóa đơn cũ chưa có dữ liệu khoản thu chi tiết.
              </p>
            )}
            <DsKeyValue
              items={[
                { label: "Tổng chi phí", value: formatCurrency(invoice.totalAmount) },
                { label: "Giảm BHYT", value: invoice.bhytDiscount > 0 ? `- ${formatCurrency(invoice.bhytDiscount)}` : formatCurrency(0) },
                { label: "Cần thu", value: <strong>{formatCurrency(invoice.finalAmount)}</strong> },
              ]}
            />
          </div>
        </div>

        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Tiêu chuẩn BHYT</h3>
          </div>
          <div className="ds-card__body">
            <DsKeyValue
              items={[
                { label: "Phần đủ điều kiện", value: formatCurrency(invoice.insuranceEligibleAmount) },
                { label: "Mức hưởng", value: `${invoice.insuranceCoverageRate}%` },
                { label: "Tuyến/loại", value: invoice.insuranceRouteType ? insuranceRouteLabel[invoice.insuranceRouteType] : "-" },
                { label: "Quỹ BHYT giảm", value: formatCurrency(invoice.insuranceDiscountAmount) },
              ]}
            />
            {invoice.insuranceNote ? (
              <p className="ds-hint" style={{ margin: 0 }}>
                Ghi chú: {invoice.insuranceNote}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ds-editor__col">
        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Thanh toán</h3>
          </div>
          <div className="ds-card__body">
            {invoice.status === "PAID" || invoice.status === "REFUNDED" ? (
              <DsKeyValue
                items={[
                  { label: "Mã biên nhận", value: invoice.invoiceCode },
                  { label: "Phương thức", value: invoice.paymentMethod ? paymentLabel[invoice.paymentMethod] || invoice.paymentMethod : "-" },
                  { label: "Thời gian", value: invoice.paidAt ? formatVietnamDateTime(invoice.paidAt) : "-" },
                  { label: "Số tiền", value: <strong>{formatCurrency(invoice.finalAmount)}</strong> },
                  ...(invoice.paymentReference ? [{ label: "Mã tham chiếu", value: invoice.paymentReference }] : []),
                ]}
              />
            ) : (
              <p style={{ margin: 0, color: "var(--ds-muted)" }}>Chưa thanh toán.</p>
            )}
            {invoice.status === "PAID" && invoice.supplements && invoice.supplements.length > 0 ? (
              <SupplementPanel invoiceId={invoice.id} supplements={invoice.supplements} canCollect={canCollect} onChanged={onChanged} />
            ) : null}
            {canRefund && invoice.status === "PAID" ? <MedicineRefundPanel invoiceId={invoice.id} onChanged={onChanged} /> : null}
            {invoice.status === "REFUNDED" ? (
              <DsKeyValue
                items={[
                  { label: "Lý do hoàn", value: invoice.refundReason || "-" },
                  ...(invoice.refundReference ? [{ label: "Tham chiếu hoàn", value: invoice.refundReference }] : []),
                  { label: "Hoàn lúc", value: invoice.refundedAt ? formatVietnamDateTime(invoice.refundedAt) : "-" },
                ]}
              />
            ) : null}
          </div>
        </div>

        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Giao dịch trực tuyến</h3>
          </div>
          {invoice.paymentTransactions.length ? (
            invoice.paymentTransactions.map((transaction) => (
              <div key={transaction.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>
                    {transaction.provider} · {transaction.transactionCode}
                  </strong>
                  <small>{formatCurrency(transaction.amount)}</small>
                  <small>
                    Tạo lúc {formatVietnamDateTime(transaction.createdAt)} · hết hạn {formatVietnamDateTime(transaction.expiredAt)}
                  </small>
                  {transaction.providerOrderId ? <small>Mã nhà cung cấp: {transaction.providerOrderId}</small> : null}
                </div>
                <DsStatusPill tone={transactionTone[transaction.status]}>{transactionStatusLabel[transaction.status]}</DsStatusPill>
              </div>
            ))
          ) : (
            <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có giao dịch trực tuyến.</p>
          )}
        </div>
      </div>
    </div>
  );
}

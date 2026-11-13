"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { usePatientInvoices, usePayInvoice } from "@/features/portal/hooks";
import { formatMoney, formatShortDate } from "@/lib/format";
import { invoiceStatusDisplay } from "@/lib/patient-status";

export default function PatientInvoicesPage() {
  const [selected, setSelected] = useState<{ invoiceId: string; provider: string } | null>(null);
  const query = usePatientInvoices();
  const payment = usePayInvoice(() => setSelected(null));

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Hóa đơn" description="Số tiền, giảm trừ BHYT và trạng thái thanh toán của từng lần khám." />

      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError || !query.data ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hóa đơn."} onRetry={() => query.refetch()} />
      ) : query.data.invoices.length === 0 ? (
        <PatientEmptyState title="Chưa có hóa đơn" description="Hóa đơn xuất hiện sau khi bệnh viện lập chi phí cho lần khám." />
      ) : (
        <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
          {query.data.invoices.map((invoice) => {
            const status = invoiceStatusDisplay(invoice.status);
            const discount = invoice.insuranceDiscountAmount || invoice.bhytDiscount;
            const pendingHere = payment.isError && selected?.invoiceId === invoice.id;
            return (
              <li key={invoice.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${status.style}`}>{status.label}</span>
                    <h2 className="mt-2 text-base font-bold">Hóa đơn {invoice.invoiceCode}</h2>
                    <p className="text-sm text-[var(--public-muted)]">Lịch #{invoice.appointment.bookingCode} · {invoice.appointment.department.name} · {formatShortDate(invoice.createdAt)}</p>
                  </div>
                  <p className="shrink-0 text-right text-xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatMoney(invoice.finalAmount)}</p>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div><dt className="text-[var(--public-muted)]">Trước giảm</dt><dd className="font-semibold tabular-nums">{formatMoney(invoice.totalAmount)}</dd></div>
                  <div><dt className="text-[var(--public-muted)]">Giảm BHYT</dt><dd className="font-semibold tabular-nums">{discount ? `−${formatMoney(discount)}` : "—"}</dd></div>
                  <div><dt className="text-[var(--public-muted)]">Phương thức</dt><dd className="font-semibold">{invoice.paymentMethod || (invoice.status === "UNPAID" ? "Chưa thanh toán" : "Tại bệnh viện")}</dd></div>
                </dl>

                {invoice.status === "PAID" ? <p className="mt-3 text-sm font-semibold text-[var(--public-success)]">Đã thanh toán {formatShortDate(invoice.paidAt)}</p> : null}

                {invoice.status === "UNPAID" ? (
                  <div className="mt-4 border-t border-[var(--public-divider)] pt-4">
                    {query.data.providers.length ? (
                      <div className="flex flex-wrap gap-2">
                        {query.data.providers.map((provider) => {
                          const busy = payment.isPending && selected?.invoiceId === invoice.id && selected.provider === provider.provider;
                          return (
                            <button
                              key={provider.provider}
                              type="button"
                              disabled={payment.isPending}
                              onClick={() => {
                                setSelected({ invoiceId: invoice.id, provider: provider.provider });
                                payment.mutate({ invoiceId: invoice.id, provider: provider.provider });
                              }}
                              className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                              Thanh toán qua {provider.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--public-text-soft)]">Chưa có cổng thanh toán trực tuyến. Thanh toán trực tiếp theo hướng dẫn của bệnh viện.</p>
                    )}
                    {pendingHere ? <p role="alert" className="mt-3 text-sm text-[var(--public-danger)]">{payment.error instanceof Error ? payment.error.message : "Không thể tạo giao dịch."}</p> : null}
                  </div>
                ) : null}

                <Link href={`/tai-khoan/hoa-don/${invoice.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem chi tiết hóa đơn</Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-[var(--public-muted)]">Số tiền lấy trực tiếp từ hóa đơn trong hệ thống. Không chuyển khoản theo đường dẫn nhận qua tin nhắn hoặc tên miền không thuộc bệnh viện.</p>
    </div>
  );
}

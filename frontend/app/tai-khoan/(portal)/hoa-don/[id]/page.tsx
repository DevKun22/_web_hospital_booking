"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { PatientPageError, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useMutationToast } from "@/components/patient/patient-toast";
import { usePatientInvoice, usePayInvoice, usePaymentProviders } from "@/features/portal/hooks";
import { formatMoney, formatShortDate } from "@/lib/format";
import { invoiceStatusDisplay } from "@/lib/patient-status";

export default function InvoiceDetailPage() {
  const id = String(useParams<{ id: string }>().id || "");
  const [selected, setSelected] = useState<string | null>(null);
  const query = usePatientInvoice(id);
  const payment = usePayInvoice();
  const providersQuery = usePaymentProviders(query.data?.status === "UNPAID");
  useMutationToast(payment, { fallbackError: "Không tạo được giao dịch." });
  if (query.isLoading) return <PatientPageLoading label="Đang tải hóa đơn..." />;
  if (query.isError || !query.data) return <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tìm thấy hóa đơn."} onRetry={() => query.refetch()} />;

  const invoice = query.data;
  const providers = providersQuery.data ?? [];
  const status = invoiceStatusDisplay(invoice.status);
  const discount = invoice.bhytDiscount || 0;
  const { appointment } = invoice;
  const meta = [
    appointment.patientName ? `Khám cho ${appointment.patientName}` : null,
    appointment.department.name,
    `lịch ${appointment.bookingCode}`,
    appointment.appointmentDate ? formatShortDate(appointment.appointmentDate) : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <Link href="/tai-khoan/hoa-don" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Quay lại hóa đơn
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{invoice.invoiceCode}</h1>
          <p className="mt-1 text-sm text-[var(--public-muted)]">{meta}</p>
        </div>
        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${status.style}`}>{status.label}</span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
          <h2 className="text-base font-bold">Chi phí</h2>
          {invoice.items?.length ? (
            <ul className="mt-3 divide-y divide-[var(--public-divider)]">
              {invoice.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.description}</span>
                    <span className="block text-xs text-[var(--public-muted)]">Đơn giá {formatMoney(item.unitPrice)} × {item.quantity}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--public-muted)]">Hóa đơn chưa có chi tiết hạng mục.</p>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5">
          <h2 className="text-base font-bold">Thanh toán</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--public-muted)]">Tổng chi phí</dt><dd className="font-semibold tabular-nums">{formatMoney(invoice.totalAmount)}</dd></div>
            {discount > 0 ? <div className="flex justify-between gap-3 text-[var(--public-success)]"><dt>Giảm trừ BHYT</dt><dd className="font-semibold tabular-nums">−{formatMoney(discount)}</dd></div> : null}
            <div className="flex justify-between gap-3 border-t border-[var(--public-divider)] pt-3 text-base">
              <dt className="font-bold">{invoice.status === "UNPAID" ? "Cần thanh toán" : "Thành tiền"}</dt>
              <dd className="font-bold tabular-nums text-[var(--public-primary-dark)]">{formatMoney(invoice.finalAmount)}</dd>
            </div>
          </dl>

          {invoice.status === "PAID" ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-[var(--public-success-soft)] p-4 text-sm text-[var(--public-success)]">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span><strong className="block">Đã thanh toán</strong>{formatShortDate(invoice.paidAt)} · {invoice.paymentMethod || "Đã ghi nhận"}</span>
            </div>
          ) : invoice.status === "UNPAID" ? (
            <div className="mt-4 space-y-2">
              {providersQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-[var(--public-muted)]" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Đang tải phương thức thanh toán...</p>
              ) : providers.length ? (
                providers.map((provider) => (
                  <button
                    key={provider.provider}
                    type="button"
                    disabled={payment.isPending}
                    onClick={() => {
                      setSelected(provider.provider);
                      payment.mutate({ invoiceId: id, provider: provider.provider });
                    }}
                    className="public-button-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
                  >
                    {payment.isPending && selected === provider.provider ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Thanh toán {formatMoney(invoice.finalAmount)} qua {provider.label}
                  </button>
                ))
              ) : (
                <p className="rounded-lg bg-[var(--public-surface-muted)] p-4 text-sm text-[var(--public-text-soft)]">Chưa có cổng thanh toán trực tuyến. Thanh toán trực tiếp theo hướng dẫn của cơ sở khám.</p>
              )}
              <p className="flex items-start gap-2 pt-1 text-xs leading-5 text-[var(--public-muted)]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Không chuyển khoản theo đường dẫn nhận qua tin nhắn hoặc tên miền không thuộc cơ sở khám.
              </p>
            </div>
          ) : (
            <p className={`mt-4 rounded-lg p-4 text-sm font-semibold ${status.style}`}>{status.label}{invoice.status === "REFUNDED" && invoice.paidAt ? ` · đã thanh toán ${formatShortDate(invoice.paidAt)}` : ""}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ReceiptText, ShieldCheck } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { patientPortalRequest } from "@/lib/patient-portal-api";
import type { PatientInvoice } from "@/lib/patient-portal-types";

type Provider = { provider: string; label: string };
type Payment = { id: string; paymentUrl?: string | null; status: string; transactionCode: string };
const formatMoney = (value?: number) => `${new Intl.NumberFormat("vi-VN").format(value || 0)} đ`;
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—";
const statuses: Record<string, { label: string; style: string }> = { UNPAID: { label: "Chờ thanh toán", style: "bg-amber-100 text-amber-800" }, PAID: { label: "Đã thanh toán", style: "bg-emerald-100 text-emerald-800" }, CANCELLED: { label: "Đã hủy", style: "bg-slate-200 text-slate-700" }, REFUNDED: { label: "Đã hoàn tiền", style: "bg-violet-100 text-violet-800" } };

export default function PatientInvoicesPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<{ invoiceId: string; provider: string } | null>(null);
  const query = useQuery({ queryKey: ["patient-invoices"], queryFn: async () => { const [invoices, capabilities] = await Promise.all([patientPortalRequest<PatientInvoice[]>("/hoa-don?page=1&limit=50"), patientPortalRequest<{ providers: Provider[] }>("/kha-nang-thanh-toan")]); return { invoices: invoices.data, providers: capabilities.data.providers }; }, staleTime: 30_000 });
  const payment = useMutation({ mutationFn: ({ invoiceId, provider }: { invoiceId: string; provider: string }) => patientPortalRequest<Payment>(`/hoa-don/${invoiceId}/thanh-toan`, { method: "POST", headers: { "Idempotency-Key": `web-${invoiceId}-${provider}-${Date.now()}` }, body: JSON.stringify({ provider }) }), onSuccess: async (result) => { if (result.data.paymentUrl) { window.location.assign(result.data.paymentUrl); return; } setSelected(null); await client.invalidateQueries({ queryKey: ["patient-invoices"] }); } });
  return <div className="space-y-6">
    <PatientPageHeader eyebrow="Tài chính" title="Hóa đơn và thanh toán" description="Theo dõi số tiền, giảm trừ BHYT và trạng thái thanh toán theo từng lần khám." />
    {query.isLoading ? <PatientPageLoading /> : query.isError || !query.data ? <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hóa đơn."} onRetry={() => query.refetch()} /> : query.data.invoices.length === 0 ? <PatientEmptyState title="Chưa có hóa đơn" description="Hóa đơn sẽ xuất hiện sau khi bệnh viện lập chi phí cho lần khám." /> : <div className="space-y-4">{query.data.invoices.map((invoice) => {
      const status = statuses[invoice.status] || { label: invoice.status, style: "bg-slate-100 text-slate-700" };
      return <article key={invoice.id} className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${status.style}`}>{status.label}</span><h2 className="mt-3 text-lg font-bold">Hóa đơn {invoice.invoiceCode}</h2><p className="mt-1 text-sm text-[var(--public-muted)]">Mã lịch #{invoice.appointment.bookingCode} · {invoice.appointment.department.name}</p></div><div className="text-right"><p className="text-xs font-semibold text-[var(--public-muted)]">Tổng thanh toán</p><strong className="mt-1 block text-2xl tabular-nums text-[var(--public-primary-dark)]">{formatMoney(invoice.finalAmount)}</strong><p className="mt-1 text-xs text-[var(--public-muted)]">Lập ngày {formatDate(invoice.createdAt)}</p></div></div>
        <div className="mt-5 grid gap-3 rounded-2xl bg-[var(--public-surface-muted)] p-4 text-sm sm:grid-cols-3"><div><span className="text-xs text-[var(--public-muted)]">Chi phí trước giảm</span><strong className="mt-1 block tabular-nums">{formatMoney(invoice.totalAmount)}</strong></div><div><span className="text-xs text-[var(--public-muted)]">Giảm trừ BHYT</span><strong className="mt-1 block tabular-nums text-emerald-700">−{formatMoney(invoice.insuranceDiscountAmount || invoice.bhytDiscount)}</strong></div><div><span className="text-xs text-[var(--public-muted)]">Phương thức</span><strong className="mt-1 block">{invoice.paymentMethod || (invoice.status === "UNPAID" ? "Chưa thanh toán" : "Tại bệnh viện")}</strong></div></div>
        {invoice.status === "PAID" ? <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Đã ghi nhận thanh toán {formatDate(invoice.paidAt)}</p> : null}
        {invoice.status === "UNPAID" ? <div className="mt-5 border-t border-[var(--public-divider)] pt-4"><p className="flex items-center gap-2 text-sm font-bold"><CreditCard className="h-4 w-4 text-[var(--public-primary)]" /> Phương thức thanh toán trực tuyến</p>{query.data.providers.length ? <div className="mt-3 flex flex-wrap gap-2">{query.data.providers.map((provider) => { const busy = payment.isPending && selected?.invoiceId === invoice.id && selected.provider === provider.provider; return <button key={provider.provider} type="button" disabled={payment.isPending} onClick={() => { setSelected({ invoiceId: invoice.id, provider: provider.provider }); payment.mutate({ invoiceId: invoice.id, provider: provider.provider }); }} className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Thanh toán qua {provider.label}</button>; })}</div> : <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--public-border)] p-4 text-sm text-[var(--public-text-soft)]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--public-primary)]" /><span>Chưa cấu hình cổng thanh toán trực tuyến. Bạn có thể thanh toán trực tiếp theo hướng dẫn của bệnh viện.</span></div>}{payment.isError && selected?.invoiceId === invoice.id ? <p role="alert" className="mt-3 text-sm text-red-700">{payment.error instanceof Error ? payment.error.message : "Không thể tạo giao dịch."}</p> : null}</div> : null}
        <div className="mt-5 flex justify-end"><Link href={`/tai-khoan/hoa-don/${invoice.id}`} className="public-button-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold">Xem chi tiết hóa đơn</Link></div>
      </article>;
    })}</div>}
    <aside className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><ReceiptText className="mt-0.5 h-5 w-5 shrink-0" /><p>Số tiền hiển thị lấy trực tiếp từ hóa đơn hệ thống. Không chuyển khoản theo đường dẫn nhận qua tin nhắn hoặc tên miền không thuộc bệnh viện.</p></aside>
  </div>;
}


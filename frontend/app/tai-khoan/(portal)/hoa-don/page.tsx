"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonName } from "@/components/patient/person-tag";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { usePatientInvoices } from "@/features/portal/hooks";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { PatientInvoice } from "@/lib/patient-portal-types";
import { invoiceStatusDisplay } from "@/lib/patient-status";

type Tab = "pending" | "paid" | "other";

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "pending", label: "Chờ thanh toán", empty: "Không có hóa đơn chờ thanh toán" },
  { key: "paid", label: "Đã thanh toán", empty: "Chưa có hóa đơn đã thanh toán" },
  { key: "other", label: "Đã hủy hoặc hoàn", empty: "Không có hóa đơn đã hủy hoặc hoàn tiền" },
];

const tabOf = (invoice: PatientInvoice): Tab => (invoice.status === "UNPAID" ? "pending" : invoice.status === "PAID" ? "paid" : "other");
// Hóa đơn của lịch cũ chưa gắn hồ sơ người thân tính là của bản thân.
const personKey = (invoice: PatientInvoice) => invoice.appointment.dependentProfileId || "";

export default function PatientInvoicesPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [person, setPerson] = useState<string | null>(null);
  const query = usePatientInvoices();
  const invoices = useMemo(() => query.data ?? [], [query.data]);

  const pending = invoices.filter((invoice) => tabOf(invoice) === "pending");
  const pendingTotal = pending.reduce((sum, invoice) => sum + invoice.finalAmount, 0);
  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const invoice of invoices) if (!map.has(personKey(invoice))) map.set(personKey(invoice), invoice.appointment.patientName || "");
    // "Bản thân" luôn đứng đầu.
    return [...map.entries()].sort(([a], [b]) => Number(a !== "") - Number(b !== ""));
  }, [invoices]);
  const activePerson = person !== null && people.some(([key]) => key === person) ? person : null;
  const items = invoices.filter((invoice) => tabOf(invoice) === tab && (activePerson === null || personKey(invoice) === activePerson));
  const current = TABS.find((item) => item.key === tab)!;

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Hóa đơn" description="Chi phí và thanh toán của từng lần khám." />

      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError || !query.data ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hóa đơn."} onRetry={() => query.refetch()} />
      ) : invoices.length === 0 ? (
        <PatientEmptyState title="Chưa có hóa đơn" description="Hóa đơn xuất hiện sau khi cơ sở khám lập chi phí cho lần khám." />
      ) : (
        <>
          {pending.length ? (
            <section aria-label="Cần thanh toán" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[var(--public-primary)] bg-[var(--public-surface)] p-4 sm:p-5">
              <div>
                <p className="text-sm text-[var(--public-muted)]">Cần thanh toán</p>
                <p className="text-2xl font-bold tabular-nums">{formatMoney(pendingTotal)}</p>
                <p className="text-sm text-[var(--public-muted)]">{pending.length} hóa đơn đang chờ</p>
              </div>
              {pending.length === 1 ? (
                <Link href={`/tai-khoan/hoa-don/${pending[0].id}`} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Thanh toán ngay</Link>
              ) : (
                <button type="button" onClick={() => setTab("pending")} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Xem hóa đơn chờ</button>
              )}
            </section>
          ) : null}

          {people.length >= 2 ? (
            <div role="group" aria-label="Lọc theo người khám" className="flex flex-wrap gap-2">
              {[["all", "Tất cả"] as const, ...people.map(([key, name]) => [key, key === "" ? "Bản thân" : name] as const)].map(([key, label]) => {
                const active = (key === "all" ? null : key) === activePerson;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPerson(key === "all" ? null : key)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" : "border-[var(--public-border)] text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div role="tablist" aria-label="Lọc hóa đơn" className="flex gap-6 overflow-x-auto border-b border-[var(--public-border)]">
            {TABS.map((item) => {
              const count = item.key === "pending" && pending.length ? ` (${pending.length})` : "";
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                  className={`-mb-px min-h-11 shrink-0 border-b-2 text-sm font-semibold transition-colors ${tab === item.key ? "border-[var(--public-primary)] text-[var(--public-primary-dark)]" : "border-transparent text-[var(--public-muted)] hover:text-[var(--public-ink)]"}`}
                >
                  {item.label}{count}
                </button>
              );
            })}
          </div>

          {items.length === 0 ? (
            <PatientEmptyState title={current.empty} description="Hóa đơn phù hợp sẽ tự xuất hiện ở đây khi có thay đổi." />
          ) : (
            <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
              {items.map((invoice) => {
                const status = invoiceStatusDisplay(invoice.status);
                const name = invoice.appointment.patientName;
                return (
                  <li key={invoice.id}>
                    <Link href={`/tai-khoan/hoa-don/${invoice.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--public-surface-muted)]">
                      <span className="min-w-0 flex-1">
                        {name ? <span className="block text-sm font-semibold"><PersonName item={{ patientName: name, dependentProfileId: invoice.appointment.dependentProfileId }} /></span> : null}
                        <span className="block truncate text-xs text-[var(--public-muted)]">
                          {invoice.invoiceCode} · {invoice.appointment.department.name} · {formatShortDate(invoice.status === "PAID" && invoice.paidAt ? invoice.paidAt : invoice.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums">{formatMoney(invoice.finalAmount)}</span>
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${status.style}`}>{status.label}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

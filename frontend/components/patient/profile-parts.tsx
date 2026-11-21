"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Plus, User, UsersRound } from "lucide-react";
import { useMutationToast } from "@/components/patient/patient-toast";
import { useCreateDependent, usePatientProfile } from "@/features/portal/hooks";
import { DEPENDENT_RELATIONSHIPS } from "@/features/booking/model";

export const FIELD_CLASS = "mt-1.5 min-h-11 w-full rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3 text-sm outline-none focus:border-[var(--public-primary)]";
export const READONLY_CLASS = `${FIELD_CLASS} bg-[var(--public-surface-muted)] text-[var(--public-text-soft)]`;

const CARD = "flex min-h-16 min-w-0 flex-1 basis-40 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors";

// Thanh chọn người dùng chung cho trang Hồ sơ và trang từng người thân: đổi người là đổi trang.
export function PersonSwitcher({ selected }: { selected: "self" | string }) {
  const router = useRouter();
  const query = usePatientProfile();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: "", relationship: "CHILD", confirmed: false });
  const [error, setError] = useState("");
  const create = useCreateDependent();
  useMutationToast(create, { success: "Đã thêm người thân.", fallbackError: "Không thể thêm người thân." });
  const profile = query.data?.profile;
  const dependents = query.data?.dependents ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.fullName.trim().length < 2) return setError("Nhập họ tên người thân, tối thiểu 2 ký tự.");
    if (!form.confirmed) return setError("Xác nhận bạn có quyền quản lý hồ sơ của người này.");
    setError("");
    create.mutate(
      { fullName: form.fullName.trim(), relationship: form.relationship, dateOfBirth: null, gender: null, hasBHYT: false, consentConfirmed: true },
      {
        onSuccess: (response) => {
          const created = (response as { data?: { id?: string } } | undefined)?.data;
          setAdding(false);
          setForm({ fullName: "", relationship: "CHILD", confirmed: false });
          if (created?.id) router.push(`/tai-khoan/ho-so/nguoi-than/${created.id}`);
        },
      },
    );
  };

  const cardClass = (active: boolean) => `${CARD} ${active ? "border-2 border-[var(--public-primary)] bg-[var(--public-primary-soft)]" : "border-[var(--public-border)] bg-[var(--public-surface)] hover:bg-[var(--public-surface-muted)]"}`;

  return (
    <nav aria-label="Chọn người khám" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href="/tai-khoan/ho-so" aria-current={selected === "self" ? "page" : undefined} className={cardClass(selected === "self")}>
          <User className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">Bản thân</span>
            <span className="block truncate text-xs text-[var(--public-muted)]">{profile?.fullName ?? "Đang tải..."}</span>
          </span>
        </Link>
        {dependents.map((item) => (
          <Link key={item.id} href={`/tai-khoan/ho-so/nguoi-than/${item.id}`} aria-current={selected === item.id ? "page" : undefined} className={cardClass(selected === item.id)}>
            <UsersRound className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{item.fullName}</span>
              <span className="block truncate text-xs text-[var(--public-muted)]">
                {DEPENDENT_RELATIONSHIPS[item.relationship] || item.relationship}
                {item.dateOfBirth ? "" : " · thiếu ngày sinh"}
              </span>
            </span>
          </Link>
        ))}
        <button type="button" aria-expanded={adding} onClick={() => setAdding((value) => !value)} className={`${CARD} border-dashed border-[var(--public-border)] text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]`}>
          <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold">Thêm người thân</span>
        </button>
      </div>

      {adding ? (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Họ và tên
              <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className={FIELD_CLASS} autoComplete="off" />
            </label>
            <label className="text-sm font-semibold">
              Mối quan hệ
              <select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} className={FIELD_CLASS}>
                {Object.entries(DEPENDENT_RELATIONSHIPS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--public-text-soft)]">
            <input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} className="mt-1 h-4 w-4" />
            Tôi xác nhận có quyền đặt lịch và quản lý hồ sơ khám cho người này.
          </label>
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-[var(--public-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setError(""); }} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Hủy</button>
            <button type="submit" disabled={create.isPending} className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-70">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Lưu và bổ sung thông tin
            </button>
          </div>
        </form>
      ) : null}
    </nav>
  );
}

export function FormSection({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-5">
      <h2 className="flex items-center justify-between gap-3 text-base font-bold">
        {title}
        {badge}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FoldSection({ title, hint, badge, children }: { title: string; hint: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-base font-bold">{title}</span>
          <span className="block text-xs text-[var(--public-muted)]">{hint}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown className="h-4 w-4 text-[var(--public-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function StateBadge({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone === "ok" ? "bg-[var(--public-success-soft)] text-[var(--public-success)]" : "bg-[var(--public-surface-muted)] text-[var(--public-text-soft)]"}`}>{children}</span>;
}

// Thanh lưu: báo có thay đổi chưa lưu hay đã lưu.
export function SaveBar({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  return (
    <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-[var(--public-text-soft)]" role="status">
        {dirty ? <span className="h-2 w-2 rounded-full bg-[var(--public-warning)]" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 text-[var(--public-success)]" aria-hidden="true" />}
        {dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
      </span>
      <button type="submit" disabled={pending || !dirty} className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Lưu thay đổi
      </button>
    </div>
  );
}

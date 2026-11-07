import { CircleAlert, Inbox, Loader2, RefreshCw } from "lucide-react";

export function PatientPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--public-primary)]">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">{description}</p></div>{action}</header>;
}

export function PatientPageLoading({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return <div className="flex min-h-[22rem] items-center justify-center gap-3 text-sm font-semibold text-[var(--public-text-soft)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--public-primary)]" aria-hidden="true" /> {label}</div>;
}

export function PatientPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="rounded-3xl border border-red-200 bg-white p-7 text-center shadow-sm"><CircleAlert className="mx-auto h-8 w-8 text-red-600" aria-hidden="true" /><h2 className="mt-3 text-lg font-bold">Chưa tải được dữ liệu</h2><p className="mt-2 text-sm text-[var(--public-muted)]">{message}</p><button type="button" onClick={onRetry} className="public-button-secondary mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Thử lại</button></div>;
}

export function PatientEmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[var(--public-border)] bg-[var(--public-surface-muted)] p-7 text-center"><Inbox className="mx-auto h-8 w-8 text-[var(--public-primary)]" aria-hidden="true" /><h2 className="mt-3 font-bold">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--public-muted)]">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}


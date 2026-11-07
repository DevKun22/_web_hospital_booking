import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PublicBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-[var(--text-muted)] sm:text-sm">
      <Link href="/" className="inline-flex items-center gap-1.5 hover:text-[var(--primary)]">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        Trang chủ
      </Link>
      <span aria-hidden="true">/</span>
      <span className="truncate font-medium text-[var(--text-soft)]" aria-current="page">
        {current}
      </span>
    </nav>
  );
}

export function PublicPageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--border-soft)] bg-[radial-gradient(circle_at_top_right,rgba(46,159,130,0.12),transparent_32%),linear-gradient(180deg,#f4fbf9_0%,#ffffff_100%)]">
      <div className="ui-container py-5 sm:py-7">
        <PublicBreadcrumb current={eyebrow} />
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)] sm:text-sm">{eyebrow}</p>
          <h1 className="mt-1.5 text-[1.75rem] font-bold leading-[1.18] tracking-[-0.025em] text-[var(--foreground)] sm:text-[2rem] lg:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">{description}</p>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

export function PublicEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--public-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export function PublicFilterPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`public-filter-panel p-3 sm:p-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function PublicCatalogSection({
  status,
  error,
  hasActiveFilters = false,
  onResetFilters,
  children,
}: {
  status: string;
  error?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="ui-container py-8 sm:py-12" aria-busy={status.startsWith("Đang tải")}>
      {error ? (
        <div className="ui-status-danger mb-4 rounded-xl border px-4 py-3 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      <div className="mb-5 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--public-muted)]" aria-live="polite">
          {status}
        </p>
        {hasActiveFilters && onResetFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary-dark)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Đặt lại bộ lọc
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

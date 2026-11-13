import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PublicBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-[var(--public-muted)] sm:text-sm">
      <Link href="/" className="inline-flex items-center gap-1.5 hover:text-[var(--public-primary)]">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        Trang chủ
      </Link>
      <span aria-hidden="true">/</span>
      <span className="truncate font-semibold text-[var(--public-ink)]" aria-current="page">
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
    <section className="border-b border-[var(--public-border)] bg-[var(--public-surface)]">
      <div className="ui-container py-5 sm:py-7">
        <PublicBreadcrumb current={eyebrow} />
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">{description}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

export function PublicEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--public-surface)] p-10 text-center text-sm text-[var(--public-muted)]">
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

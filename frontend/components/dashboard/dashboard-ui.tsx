import type { ReactNode } from "react";

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-medium text-[var(--text-muted)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function DashboardSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${className}`}>
      {children}
    </section>
  );
}

export function DashboardEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p> : null}
    </div>
  );
}

export function DashboardTableRegion({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto overscroll-x-contain" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

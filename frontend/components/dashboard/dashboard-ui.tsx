import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export function DashboardSectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function DashboardFilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("sticky top-[4.5rem] z-10 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-3 shadow-[var(--shadow-sm)] backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

const metricToneClass = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  positive: "ui-status-positive",
  warning: "ui-status-warning",
  danger: "ui-status-danger",
  neutral: "ui-status-neutral",
};

export function DashboardMetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: keyof typeof metricToneClass;
}) {
  return (
    <div className={cn("rounded-xl border p-4 shadow-[var(--shadow-sm)]", metricToneClass[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium opacity-75">{label}</p>
        {icon ? <span className="opacity-75">{icon}</span> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.02em]">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
    </div>
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

const statusToneClass = {
  positive: "ui-status-positive",
  info: "ui-status-info",
  warning: "ui-status-warning",
  danger: "ui-status-danger",
  neutral: "ui-status-neutral",
};

export function DashboardStatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof statusToneClass;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1.5 px-2.5", statusToneClass[tone], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}

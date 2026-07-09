import { ArrowLeft, ArrowRight, Home } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PublicPageHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl">
      <div className="ui-container flex min-h-16 items-center justify-between gap-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Về trang chủ</span>
        </Link>
        <Link
          href="/#booking"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--primary-hover)]"
        >
          Đặt lịch
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

export function PublicBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
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
    <section className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,#f4f9ff_0%,#ffffff_100%)]">
      <div className="ui-container py-10 sm:py-14">
        <PublicBreadcrumb current={eyebrow} />
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.025em] text-[var(--foreground)] sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">{description}</p>
        </div>
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </section>
  );
}

export function PublicEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-10 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}

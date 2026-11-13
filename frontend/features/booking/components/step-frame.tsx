import type { ReactNode } from "react";

// Khung chung của mỗi bước: số thứ tự, tiêu đề, nội dung.
export function StepFrame({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`booking-step-${number}`} className="rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm sm:p-6">
      <header className="mb-5 flex items-start gap-3 border-b border-[var(--public-divider)] pb-4">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
          <span className="text-xs font-bold tabular-nums">0{number}</span>
        </span>
        <div>
          <h2 id={`booking-step-${number}`} tabIndex={-1} className="text-sm font-bold text-[var(--public-ink)] focus:outline-none">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

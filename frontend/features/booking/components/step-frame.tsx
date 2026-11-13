import type { ReactNode } from "react";

// Khung chung của mỗi bước: tiêu đề (nhận tiêu điểm khi đổi bước), mô tả một dòng, nội dung.
export function StepFrame({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-6">
      <h2 tabIndex={-1} className="text-lg font-bold leading-snug text-[var(--public-ink)] focus:outline-none sm:text-xl">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

const LABEL = "block text-sm font-semibold text-[var(--public-ink)]";

// Nhãn luôn hiện phía trên ô nhập (không dùng placeholder làm nhãn); dòng gợi ý nhỏ phía dưới.
export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>
        {label}
        {required ? <span className="ml-0.5 text-[var(--public-danger)]" aria-hidden="true">*</span> : null}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-[var(--public-muted)]">{hint}</span> : null}
    </label>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <legend className={LABEL}>{children}</legend>;
}

export const INPUT_CLASS = "ui-field w-full px-3 text-base sm:text-sm";

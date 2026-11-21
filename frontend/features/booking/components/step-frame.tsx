import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// Khung chung của mỗi bước: tiêu đề (nhận tiêu điểm khi đổi bước), mô tả một dòng, nội dung; lỗi chọn thiếu của bước hiện ngay cuối khung.
export function StepFrame({ title, description, error, children }: { title: string; description?: string; error?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-6">
      <h2 tabIndex={-1} className="scroll-mt-32 text-lg font-bold leading-snug text-[var(--public-ink)] focus:outline-none sm:text-xl">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
      {error ? (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm font-medium text-[var(--public-danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </section>
  );
}

const LABEL = "block text-sm font-semibold text-[var(--public-ink)]";

type ControlProps = { id?: string; className?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

// Nhãn luôn hiện phía trên ô nhập (không dùng placeholder làm nhãn); dòng gợi ý nhỏ phía dưới.
// Ô sai: viền đỏ, biểu tượng cảnh báo và câu lỗi ngay dưới ô (gắn aria-invalid và aria-describedby). Ô đúng sau khi đã nhập: viền xanh và dấu tích.
export function Field({
  label,
  hint,
  required,
  error,
  success,
  fieldId,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  success?: string;
  /** Mã ô, dùng để khung tóm tắt lỗi trỏ tới đúng ô. */
  fieldId?: string;
  children: ReactNode;
}) {
  const generated = useId();
  const id = fieldId ?? generated;
  const messageId = `${id}-message`;
  const state = error ? "error" : success ? "success" : "idle";
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || success || hint ? messageId : undefined,
        className: `${(children.props as ControlProps).className ?? ""} ${state === "error" ? "!border-[var(--public-danger)]" : state === "success" ? "!border-[var(--public-success)]" : ""} ${state !== "idle" && (children as ReactElement).type === "input" ? "pr-10" : ""}`.trim(),
      })
    : children;
  const isInput = isValidElement(children) && children.type === "input";

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {required ? <span className="ml-0.5 text-[var(--public-danger)]" aria-hidden="true">*</span> : null}
      </label>
      <div className="relative mt-1.5">
        {control}
        {isInput && state === "error" ? <AlertCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-danger)]" aria-hidden="true" /> : null}
        {isInput && state === "success" ? <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-success)]" aria-hidden="true" /> : null}
      </div>
      <div id={messageId}>
        {error ? <p role="alert" className="mt-1.5 text-sm font-medium text-[var(--public-danger)]">{error}</p> : null}
        {!error && success ? <p className="mt-1.5 text-sm font-medium text-[var(--public-success)]">{success}</p> : null}
        {!error && !success && hint ? <p className="mt-1.5 text-xs leading-5 text-[var(--public-muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <legend className={LABEL}>{children}</legend>;
}

export const INPUT_CLASS = "ui-field w-full px-3 text-base sm:text-sm";

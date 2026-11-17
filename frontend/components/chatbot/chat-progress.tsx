import { Check, X } from "lucide-react";
import { getBookingProgress, getSelectionChips, type ClearableField } from "@/lib/chatbot-ui";
import type { ChatbotDraftSummary } from "@/lib/types";

// Cho người dùng thấy "mình đang ở đâu và đã chọn gì": thanh bốn bước đặt lịch và các thẻ lựa chọn, bấm × để bỏ từng mục.
export function ChatProgress({
  summary,
  disabled,
  onClear,
}: {
  summary?: ChatbotDraftSummary;
  disabled?: boolean;
  onClear: (field: ClearableField, label: string) => void;
}) {
  const progress = getBookingProgress(summary);
  if (!progress) return null;
  const chips = getSelectionChips(summary);

  return (
    <div className="kun-enter border-b border-[var(--public-divider)] bg-[var(--public-surface-muted)] px-4 py-2">
      <ol className="flex items-center gap-1.5" aria-label="Tiến trình đặt lịch">
        {progress.steps.map((step, index) => {
          const current = index === progress.activeIndex;
          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={current ? "step" : undefined}>
              <span
                className={`h-1 rounded-full transition-colors duration-300 ${step.done ? "bg-[var(--public-primary)]" : current ? "bg-[var(--public-primary)]/40" : "bg-[var(--public-border)]"}`}
              />
              <span className={`flex items-center gap-1 truncate text-[11px] ${current ? "font-semibold text-[var(--public-primary)]" : "text-[var(--public-muted)]"}`}>
                {step.done ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
                <span className="truncate">{step.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {chips.length ? (
        <ul className="kun-scroll-x mt-1.5 flex gap-1.5 overflow-x-auto">
          {chips.map((chip) => (
            <li key={`${chip.field}-${chip.label}`} className="kun-pop shrink-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onClear(chip.field, chip.label)}
                className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-[var(--public-primary-soft)] py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-[var(--public-primary-dark)] transition hover:bg-[var(--public-primary)] hover:text-white disabled:opacity-60"
                aria-label={`Bỏ lựa chọn ${chip.label}`}
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

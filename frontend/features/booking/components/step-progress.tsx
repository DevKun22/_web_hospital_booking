import { STEP_ORDER, stepIndex, type BookingStep } from "@/features/booking/model";

const LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  service: "Dịch vụ",
  schedule: "Ngày và giờ",
  details: "Thông tin",
  verify: "Xác thực",
};

// Bốn đoạn thanh mảnh, đoạn đã qua và đang ở tô màu chính; nhãn bước hiện từ cỡ máy tính bảng.
export function StepProgress({ step }: { step: BookingStep }) {
  const active = stepIndex(step);
  const done = step === "done";

  return (
    <div>
      <p className="text-sm text-[var(--public-muted)]">
        {done ? (
          "Hoàn tất"
        ) : (
          <>
            Bước <strong className="font-semibold text-[var(--public-ink)]">{active + 1}</strong> trên {STEP_ORDER.length}
            <span className="hidden sm:inline">{` · ${LABELS[STEP_ORDER[active]]}`}</span>
          </>
        )}
      </p>
      <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Các bước đặt lịch">
        {STEP_ORDER.map((key, index) => {
          const reached = done || index <= active;
          return (
            <li key={key} aria-current={!done && index === active ? "step" : undefined}>
              <span className={`block h-1 rounded-full ${reached ? "bg-[var(--public-primary)]" : "bg-[var(--public-border)]"}`} />
              <span className={`mt-1.5 hidden text-xs sm:block ${reached ? "font-semibold text-[var(--public-ink)]" : "text-[var(--public-muted)]"}`}>{LABELS[key]}</span>
              <span className="sr-only">{`${LABELS[key]}${reached ? (done || index < active ? ", đã xong" : ", đang làm") : ""}`}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

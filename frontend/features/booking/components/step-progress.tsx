import { CheckCircle2 } from "lucide-react";
import { STEP_ORDER, stepIndex, type BookingStep } from "@/features/booking/model";

const LABELS: Record<(typeof STEP_ORDER)[number], { label: string; description: string }> = {
  service: { label: "Dịch vụ", description: "Chuyên khoa & bác sĩ" },
  schedule: { label: "Thời gian", description: "Ngày & khung giờ" },
  details: { label: "Thông tin", description: "Người khám & BHYT" },
  verify: { label: "Xác thực", description: "Mã OTP 6 số" },
};

export function StepProgress({ step }: { step: BookingStep }) {
  const active = stepIndex(step);
  const done = step === "done";
  const last = STEP_ORDER.length - 1;

  return (
    <div className="relative rounded-2xl border border-[var(--public-border)] bg-white px-2 py-4 shadow-sm sm:px-4">
      <span className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[2.05rem] h-0.5 bg-[var(--public-border)]" aria-hidden="true">
        <span
          className="block h-full bg-[var(--public-primary)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(Math.min(active, last) / last) * 100}%` }}
        />
      </span>
      <ol className="relative grid grid-cols-4" aria-label="Các bước đặt lịch">
        {STEP_ORDER.map((key, index) => {
          const completed = index < active || (done && index === last);
          const current = !done && index === active;
          const { label, description } = LABELS[key];
          return (
            <li key={key} aria-current={current ? "step" : undefined} className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm ${
                  completed
                    ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
                    : current
                      ? "border-[var(--public-primary)] bg-white text-[var(--public-primary)] ring-4 ring-[var(--public-primary-soft)]"
                      : "border-[var(--public-border)] bg-[var(--public-surface-muted)] text-[var(--public-muted)]"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={`mt-2 text-[11px] font-bold sm:text-xs ${completed || current ? "text-[var(--public-primary-dark)]" : "text-[var(--public-muted)]"}`}>
                {label}
              </span>
              <span className="mt-0.5 hidden text-[10px] leading-4 text-[var(--public-muted)] sm:block">{description}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

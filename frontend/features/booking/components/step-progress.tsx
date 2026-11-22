import { CalendarSearch, Check, ClipboardList, ShieldCheck, Stethoscope } from "lucide-react";
import { STEP_ORDER, stepIndex, type BookingStep } from "@/features/booking/model";

const LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  service: "Dịch vụ",
  schedule: "Ngày và giờ",
  details: "Thông tin",
  verify: "Xác thực",
};

const ICONS = { service: Stethoscope, schedule: CalendarSearch, details: ClipboardList, verify: ShieldCheck } as const;

// Thanh bước trên nền xanh của đầu trang: nút tròn nối nhau bằng đường kẻ, bước đã xong có dấu tích (bấm để quay lại khi chưa gửi mã OTP), bước hiện tại có quầng sáng.
function BrandStepProgress({ step, onGo }: { step: BookingStep; onGo?: (step: "service" | "schedule" | "details") => void }) {
  const active = stepIndex(step);
  const done = step === "done";
  return (
    <ol className="mt-4 grid grid-cols-4" aria-label="Các bước đặt lịch">
      {STEP_ORDER.map((key, index) => {
        const finished = done || index < active;
        const current = !done && index === active;
        const Icon = ICONS[key];
        const canGo = Boolean(onGo) && finished && !done && step !== "verify" && key !== "verify";
        const node = (
          <span
            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
              finished || current ? "border-white bg-white text-[var(--hero-from)]" : "border-white/60 text-white"
            } ${current ? "ring-4 ring-white/25" : ""}`}
            aria-hidden="true"
          >
            {finished ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </span>
        );
        return (
          <li key={key} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {index < STEP_ORDER.length - 1 ? (
              <span aria-hidden="true" className="absolute left-[calc(50%+1.25rem)] top-4 h-0.5 w-[calc(100%-2.5rem)] bg-white/30">
                <span className={`block h-full bg-white transition-[width] duration-300 motion-reduce:transition-none ${finished ? "w-full" : "w-0"}`} />
              </span>
            ) : null}
            {canGo ? (
              <button type="button" onClick={() => onGo?.(key as "service" | "schedule" | "details")} aria-label={`Quay lại bước ${LABELS[key]}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{node}</button>
            ) : (
              node
            )}
            <span className={`mt-1.5 hidden text-xs sm:block ${current ? "font-semibold text-white" : "text-white/80"}`}>{LABELS[key]}</span>
            <span className="sr-only">{`${LABELS[key]}${finished ? ", đã xong" : current ? ", đang làm" : ""}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Bốn đoạn thanh mảnh, đoạn đã qua và đang ở tô màu chính; nhãn bước hiện từ cỡ máy tính bảng.
export function StepProgress({ step, compact = false, onBrand = false, onGo }: { step: BookingStep; compact?: boolean; onBrand?: boolean; onGo?: (step: "service" | "schedule" | "details") => void }) {
  if (onBrand) return <BrandStepProgress step={step} onGo={onGo} />;
  const active = stepIndex(step);
  const done = step === "done";

  // Dải gọn dính dưới thanh menu khi phần đầu trang đã cuộn khuất: một dòng chữ và bốn đoạn tiến trình.
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-sm font-medium text-[var(--public-ink)]">
          {done ? "Hoàn tất" : <>Bước {active + 1}/{STEP_ORDER.length}<span className="hidden sm:inline">{` · ${LABELS[STEP_ORDER[active]]}`}</span></>}
        </p>
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
          {STEP_ORDER.map((key, index) => (
            <span key={key} className={`block h-1 rounded-full ${done || index <= active ? "bg-[var(--public-primary)]" : "bg-[var(--public-border)]"}`} />
          ))}
        </div>
      </div>
    );
  }

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

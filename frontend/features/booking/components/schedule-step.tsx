"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { buildDayStrip, groupSlotsByPeriod } from "@/features/booking/dates";
import { todayInVietnam } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { StepFrame } from "@/features/booking/components/step-frame";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { formatVietnamDate, getVietnamTimeInput } from "@/lib/date";

const formatTime = (value: string) => value.slice(0, 5);
const DAY_COUNT = 14;

export function ScheduleStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, slots, slotsLoading } = flow;
  const { selection, draft } = state;
  const today = todayInVietnam();
  const days = buildDayStrip(today, DAY_COUNT);
  const inStrip = days.some((day) => day.value === draft.date);
  const groups = groupSlotsByPeriod(slots);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const pickDate = (value: string) => dispatch({ type: "draft_changed", patch: { date: value, timeSlotId: "" } });

  return (
    <StepFrame title="Chọn ngày và giờ khám" description="Chỉ hiển thị khung giờ còn trống của bác sĩ đã chọn. Giờ theo múi giờ Việt Nam.">
      <div>
        <p className="text-sm font-semibold text-[var(--public-ink)]">Ngày khám</p>
        <div ref={stripRef} role="radiogroup" aria-label="Ngày khám" className="ui-hide-scrollbar -mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          {days.map((day) => {
            const selected = draft.date === day.value;
            return (
              <button
                key={day.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${day.weekday} ${day.day}/${day.month}${day.isToday ? ", hôm nay" : ""}`}
                onClick={() => pickDate(day.value)}
                className={`flex h-16 w-14 shrink-0 snap-start flex-col items-center justify-center rounded-lg border text-center transition-colors ${
                  selected
                    ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
                    : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-ink)] hover:border-[var(--public-primary)]"
                }`}
              >
                <span className={`text-xs ${selected ? "text-white" : day.isSunday ? "text-[var(--public-danger)]" : "text-[var(--public-muted)]"}`}>{day.isToday ? "Nay" : day.weekday}</span>
                <span className="text-lg font-bold leading-6 tabular-nums">{day.day}</span>
                <span className={`text-[11px] leading-3 tabular-nums ${selected ? "text-white" : "text-[var(--public-muted)]"}`}>/{day.month}</span>
              </button>
            );
          })}
        </div>
        <details className="mt-3 text-sm" open={!inStrip && Boolean(draft.date)}>
          <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold text-[var(--public-primary)] underline underline-offset-4">Chọn ngày khác</summary>
          <div className="mt-2 max-w-xs">
            <VietnamDateInput value={draft.date} min={today} onChange={pickDate} ariaLabel="Ngày khám khác" className="ui-field w-full px-3 text-base sm:text-sm" />
          </div>
        </details>
      </div>

      <div aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--public-ink)]">Khung giờ trống</p>
          {slotsLoading ? (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--public-muted)]" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Đang tải
            </span>
          ) : null}
        </div>

        {!selection.doctorId ? (
          <EmptyNote>Chọn bác sĩ ở bước trước để xem khung giờ.</EmptyNote>
        ) : slotsLoading ? (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="skeleton-shimmer h-11 rounded-lg" />
            ))}
          </div>
        ) : groups.length ? (
          <div className="mt-2 space-y-4">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">{group.label}</p>
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={group.label}>
                  {group.slots.map((slot) => {
                    const selected = draft.timeSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => dispatch({ type: "slot_chosen", slot })}
                        className={`min-h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${
                          selected
                            ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)] shadow-[inset_0_0_0_1px_var(--public-primary)]"
                            : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-ink)] hover:border-[var(--public-primary)]"
                        }`}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>
            {draft.date === today
              ? `Hôm nay không còn khung giờ nào sau ${getVietnamTimeInput()}. Hãy chọn ngày khác.`
              : `Ngày ${formatVietnamDate(draft.date)} chưa có khung giờ trống. Hãy chọn ngày khác hoặc đổi bác sĩ.`}
          </EmptyNote>
        )}
      </div>
    </StepFrame>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 rounded-lg border border-dashed border-[var(--public-border)] px-3 py-3 text-sm leading-6 text-[var(--public-muted)]">{children}</p>;
}

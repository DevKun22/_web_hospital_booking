"use client";

import { Check, Loader2 } from "lucide-react";
import { groupSlotsByPeriod } from "@/features/booking/dates";
import { MonthCalendar } from "@/features/booking/components/month-calendar";
import { StepFrame } from "@/features/booking/components/step-frame";
import { todayInVietnam } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { formatVietnamDate, getVietnamTimeInput } from "@/lib/date";

const formatTime = (value: string) => value.slice(0, 5);

// Bước chọn ngày và giờ: bảng lịch tháng (chấm xanh là ngày còn giờ) ở trái, khung giờ của ngày đang chọn ở phải;
// điện thoại xếp dọc. Giờ đã chọn nền xanh có dấu tích, bấm giờ khác để đổi.
export function ScheduleStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, slots, slotsLoading } = flow;
  const { selection, draft } = state;
  const today = todayInVietnam();
  const groups = groupSlotsByPeriod(slots);
  const chosen = slots.find((slot) => slot.id === draft.timeSlotId);
  const pickDate = (value: string) => dispatch({ type: "draft_changed", patch: { date: value, timeSlotId: "" } });

  return (
    <StepFrame error={state.stepError} title="Chọn ngày và giờ khám" description="Chỉ hiển thị khung giờ còn trống của bác sĩ đã chọn. Giờ theo múi giờ Việt Nam.">
      {!selection.doctorId ? (
        <EmptyNote>Chọn bác sĩ ở bước trước để xem lịch.</EmptyNote>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--public-ink)]">Ngày khám</p>
            <MonthCalendar doctorId={selection.doctorId} today={today} value={draft.date} onChange={pickDate} />
          </div>

          <div aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--public-ink)]">{draft.date ? `Giờ trống ngày ${formatVietnamDate(draft.date)}` : "Khung giờ trống"}</p>
              {slotsLoading ? (
                <span className="inline-flex items-center gap-1 text-sm text-[var(--public-muted)]" role="status">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Đang tải
                </span>
              ) : null}
            </div>

            {!draft.date ? (
              <EmptyNote>Chọn một ngày trên lịch để xem giờ trống.</EmptyNote>
            ) : slotsLoading ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span key={index} className="skeleton-shimmer h-11 rounded-lg" />
                ))}
              </div>
            ) : groups.length ? (
              <div className="mt-2 space-y-4">
                {groups.map((group) => (
                  <div key={group.key}>
                    <p className="text-sm font-medium text-[var(--public-muted)]">{group.label}</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label={group.label}>
                      {group.slots.map((slot) => {
                        const selected = draft.timeSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => dispatch({ type: "slot_chosen", slot })}
                            className={`relative inline-flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)] ${
                              selected
                                ? "border-[var(--public-solid)] bg-[var(--public-solid)] text-[var(--public-on-solid)]"
                                : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-ink)] hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]"
                            }`}
                          >
                            {selected ? <Check className="absolute left-2 h-4 w-4" aria-hidden="true" /> : null}
                            {formatTime(slot.startTime)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-sm text-[var(--public-text-soft)]">
                  {chosen ? <>Đã chọn <strong className="font-semibold tabular-nums text-[var(--public-ink)]">{formatTime(chosen.startTime)}</strong>. Bấm giờ khác để đổi.</> : "Bấm vào một giờ để chọn."}
                </p>
              </div>
            ) : (
              <EmptyNote>
                {draft.date === today
                  ? `Hôm nay không còn khung giờ nào sau ${getVietnamTimeInput()}. Hãy chọn ngày khác.`
                  : `Ngày ${formatVietnamDate(draft.date)} chưa có khung giờ trống. Hãy chọn ngày khác hoặc đổi bác sĩ.`}
              </EmptyNote>
            )}
          </div>
        </div>
      )}
    </StepFrame>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 rounded-lg border border-dashed border-[var(--public-border)] px-3 py-3 text-sm leading-6 text-[var(--public-muted)]">{children}</p>;
}

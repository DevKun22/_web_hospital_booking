import { ChevronRight, Clock, Loader2 } from "lucide-react";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { StepFrame } from "@/features/booking/components/step-frame";
import { todayInVietnam } from "@/features/booking/model";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { formatVietnamDate, getVietnamTimeInput } from "@/lib/date";

const formatTime = (value: string) => value.slice(0, 5);

export function ScheduleStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, slots, slotsLoading, actions } = flow;
  const { selection, draft } = state;
  const today = todayInVietnam();

  return (
    <StepFrame number={2} title="Chọn ngày và khung giờ khám">
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="block">
          <span className="text-sm font-medium text-[var(--public-text-soft)]">Ngày khám</span>
          <VietnamDateInput
            value={draft.date}
            min={today}
            onChange={(value) => dispatch({ type: "draft_changed", patch: { date: value, timeSlotId: "" } })}
            ariaLabel="Ngày khám"
            className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
          />
          <span className="mt-1 block text-xs text-[var(--public-muted)]">Hiển thị theo ngày/tháng/năm, múi giờ Việt Nam</span>
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[var(--public-text-soft)]">Khung giờ trống</span>
            {slotsLoading ? (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--public-muted)]" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Đang tải
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex min-h-11 flex-wrap gap-2">
            {!selection.doctorId ? (
              <EmptyNote>Chọn bác sĩ để xem khung giờ.</EmptyNote>
            ) : slotsLoading ? (
              Array.from({ length: 4 }).map((_, index) => <span key={index} className="skeleton-shimmer h-10 w-24 rounded-md" />)
            ) : slots.length ? (
              slots.map((slot) => {
                const selected = draft.timeSlotId === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => dispatch({ type: "slot_chosen", slot })}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)] shadow-sm ring-2 ring-[var(--public-border)]"
                        : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]"
                    }`}
                  >
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </button>
                );
              })
            ) : (
              <EmptyNote>
                {draft.date === today
                  ? `Không còn khung giờ khả dụng hôm nay sau ${getVietnamTimeInput()}. Các giờ đã qua sẽ không hiển thị.`
                  : `Chưa có khung giờ trống trong ngày ${formatVietnamDate(draft.date)}.`}
              </EmptyNote>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--public-divider)] pt-4">
        <button type="button" onClick={() => actions.goToStep("service")} className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold">
          Quay lại
        </button>
        <button type="button" onClick={actions.continueFromSchedule} className="public-button-primary ml-auto inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold">
          Tiếp tục
          <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </StepFrame>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-dashed border-[var(--public-border)] px-3 py-2 text-sm text-[var(--public-muted)]">{children}</span>;
}

"use client";

import { buildDayStrip } from "@/features/booking/dates";

// Dải ngày chọn nhanh (cuộn ngang): hôm nay trở đi, mặc định 14 ngày. Dùng ở đặt lịch và trang bác sĩ.
export function DayStrip({ today, value, onChange, count = 14, label = "Ngày khám" }: { today: string; value: string; onChange: (value: string) => void; count?: number; label?: string }) {
  const days = buildDayStrip(today, count);
  return (
    <div role="radiogroup" aria-label={label} className="ui-hide-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {days.map((day) => {
        const selected = value === day.value;
        return (
          <button
            key={day.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${day.weekday} ${day.day}/${day.month}${day.isToday ? ", hôm nay" : ""}`}
            onClick={() => onChange(day.value)}
            className={`flex h-16 w-14 shrink-0 snap-start flex-col items-center justify-center rounded-lg border text-center transition-colors ${
              selected ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-ink)] hover:border-[var(--public-primary)]"
            }`}
          >
            <span className={`text-xs ${selected ? "text-white" : day.isSunday ? "text-[var(--public-danger)]" : "text-[var(--public-muted)]"}`}>{day.isToday ? "Nay" : day.weekday}</span>
            <span className="text-lg font-bold leading-6 tabular-nums">{day.day}</span>
            <span className={`text-[11px] leading-3 tabular-nums ${selected ? "text-white" : "text-[var(--public-muted)]"}`}>/{day.month}</span>
          </button>
        );
      })}
    </div>
  );
}

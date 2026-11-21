"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { addDays } from "@/features/booking/dates";
import { usePublicAvailableDates } from "@/lib/public-slots-query";

const WEEKDAY_HEADS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
const WEEKDAY_NAMES = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const MAX_MONTHS_AHEAD = 3;

const monthKey = (value: string) => value.slice(0, 7);
const shiftMonth = (key: string, amount: number) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 7);
};
const lastDayOf = (key: string) => addDays(`${shiftMonth(key, 1)}-01`, -1);
const weekdayOf = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

type MonthCalendarProps = {
  doctorId: string;
  /** Hôm nay theo giờ Việt Nam (yyyy-mm-dd). */
  today: string;
  /** Ngày đang chọn (yyyy-mm-dd) hoặc rỗng. */
  value: string;
  onChange: (value: string) => void;
};

const navButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--public-border)] hover:border-[var(--public-primary)] disabled:cursor-not-allowed disabled:opacity-40";

// Bảng lịch tháng chọn ngày khám: ngày còn giờ trống có chấm xanh, ngày đã qua hoặc hết giờ thì mờ và không chọn được,
// hôm nay có viền nét đứt. Dữ liệu ngày còn giờ lấy theo tháng đang xem; trong lúc tải, các ngày từ hôm nay trở đi vẫn chọn được.
export function MonthCalendar({ doctorId, today, value, onChange }: MonthCalendarProps) {
  const [month, setMonth] = useState(() => monthKey(value || today));
  // Ngày được chọn từ nơi khác (ví dụ điền sẵn) thì lịch nhảy sang tháng của ngày đó.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value) setMonth(monthKey(value));
  }

  const firstOfMonth = `${month}-01`;
  const query = usePublicAvailableDates({ doctorId, from: firstOfMonth > today ? firstOfMonth : today, to: lastDayOf(month) });
  const available = useMemo(() => new Map((query.data ?? []).map((item) => [item.date, item.count])), [query.data]);
  const loaded = Boolean(query.data);

  const days = Array.from({ length: Number(lastDayOf(month).slice(8, 10)) }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const leading = (weekdayOf(firstOfMonth) + 6) % 7;
  const currentMonth = monthKey(today);
  const lastMonth = shiftMonth(currentMonth, MAX_MONTHS_AHEAD);
  const [year, monthNumber] = month.split("-");

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Tháng trước" disabled={month <= currentMonth} onClick={() => setMonth(shiftMonth(month, -1))} className={navButton}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="inline-flex items-center gap-2 text-base font-semibold" aria-live="polite">
          Tháng {Number(monthNumber)}, {year}
          {query.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--public-muted)]" aria-hidden="true" /> : null}
        </p>
        <button type="button" aria-label="Tháng sau" disabled={month >= lastMonth} onClick={() => setMonth(shiftMonth(month, 1))} className={navButton}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="group" aria-label={`Lịch tháng ${Number(monthNumber)} năm ${year}`}>
        {WEEKDAY_HEADS.map((head) => (
          <span key={head} className="py-1 text-xs font-medium text-[var(--public-muted)]">{head}</span>
        ))}
        {Array.from({ length: leading }).map((_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {days.map((day) => {
          const count = available.get(day) ?? 0;
          const past = day < today;
          const disabled = past || (loaded && count === 0);
          const selected = value === day;
          const isToday = day === today;
          const stateLabel = loaded && !past ? (count ? `, còn ${count} giờ trống` : ", hết giờ trống") : "";
          const label = `${WEEKDAY_NAMES[weekdayOf(day)]} ${day.slice(8, 10)}/${day.slice(5, 7)}${isToday ? ", hôm nay" : ""}${stateLabel}`;
          const tone = selected
            ? "border-[var(--public-solid)] bg-[var(--public-solid)] font-semibold text-[var(--public-on-solid)]"
            : disabled
              ? "cursor-not-allowed border-transparent text-[var(--public-muted)] opacity-45"
              : `border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-ink)] hover:border-[var(--public-primary)] ${isToday ? "border-dashed" : ""}`;
          return (
            <button
              key={day}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(day)}
              className={`relative flex min-h-11 items-center justify-center rounded-lg border text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)] ${tone}`}
            >
              {Number(day.slice(8, 10))}
              {count > 0 && !disabled ? (
                <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${selected ? "bg-[var(--public-on-solid)]" : "bg-[var(--public-success)]"}`} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-[var(--public-muted)]">
        {query.isError ? "Chưa tải được ngày còn giờ trống, bạn vẫn có thể chọn ngày." : "Chấm xanh là ngày còn giờ trống."}
      </p>
    </div>
  );
}

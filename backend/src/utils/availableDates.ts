import { isSlotStartInPastVietnamTime } from "./time.js";

export const MAX_AVAILABLE_DATE_RANGE_DAYS = 62;

export type AvailableDateSlot = { date: Date; startTime: string };

/** Gom các khung giờ còn trống theo ngày (YYYY-MM-DD), bỏ khung đã qua giờ bắt đầu; kết quả xếp tăng dần theo ngày. */
export const summarizeAvailableDates = (
  slots: AvailableDateSlot[],
  isPast: (date: Date, startTime: string) => boolean = isSlotStartInPastVietnamTime,
) => {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    if (isPast(slot.date, slot.startTime)) continue;
    const key = slot.date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
};

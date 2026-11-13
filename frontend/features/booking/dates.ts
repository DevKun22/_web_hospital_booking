import type { BookingSlot } from "@/features/booking/model";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export type DayOption = {
  value: string; // yyyy-mm-dd
  weekday: (typeof WEEKDAYS)[number];
  day: string; // dd
  month: string; // mm
  isToday: boolean;
  isSunday: boolean;
};

const parts = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
};

// Cộng ngày trên chuỗi yyyy-mm-dd bằng UTC để không phụ thuộc múi giờ máy.
export const addDays = (value: string, amount: number) => {
  const { year, month, day } = parts(value);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
};

const weekdayOf = (value: string) => {
  const { year, month, day } = parts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

// Dải ngày để chọn nhanh: từ hôm nay trở đi, `count` ngày.
export function buildDayStrip(today: string, count = 14): DayOption[] {
  return Array.from({ length: count }, (_, index) => {
    const value = addDays(today, index);
    const weekday = weekdayOf(value);
    return {
      value,
      weekday: WEEKDAYS[weekday],
      day: value.slice(8, 10),
      month: value.slice(5, 7),
      isToday: index === 0,
      isSunday: weekday === 0,
    };
  });
}

export type SlotGroup = { key: "morning" | "afternoon"; label: string; slots: BookingSlot[] };

// Chia khung giờ theo buổi (trước 12:00 là buổi sáng), bỏ nhóm rỗng, giữ thứ tự giờ.
export function groupSlotsByPeriod(slots: BookingSlot[]): SlotGroup[] {
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const groups: SlotGroup[] = [
    { key: "morning", label: "Buổi sáng", slots: sorted.filter((slot) => slot.startTime < "12:00") },
    { key: "afternoon", label: "Buổi chiều", slots: sorted.filter((slot) => slot.startTime >= "12:00") },
  ];
  return groups.filter((group) => group.slots.length > 0);
}

// "T6 13/11/2026" dùng cho dòng tóm tắt.
export function formatDayShort(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const { year, month, day } = parts(value);
  return `${WEEKDAYS[weekdayOf(value)]} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

import { AppError } from "./appError.js";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parseTimeToMinutes = (time: string) => {
  const match = time.match(timeRegex);

  if (!match) {
    throw new AppError("Thoi gian phai co dinh dang HH:mm", 400);
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

export const formatMinutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");

  return `${hours}:${mins}`;
};

export const validateTimeRange = (startTime: string, endTime: string) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start >= end) {
    throw new AppError("Gio bat dau phai nho hon gio ket thuc", 400);
  }

  return { start, end };
};

export const buildTimeSlots = (
  startTime: string,
  endTime: string,
  slotDuration: number,
) => {
  if (slotDuration <= 0) {
    throw new AppError("Thoi luong slot khong hop le", 400);
  }

  const { start, end } = validateTimeRange(startTime, endTime);
  const slots: { startTime: string; endTime: string }[] = [];

  for (
    let current = start;
    current + slotDuration <= end;
    current += slotDuration
  ) {
    slots.push({
      startTime: formatMinutesToTime(current),
      endTime: formatMinutesToTime(current + slotDuration),
    });
  }

  if (!slots.length) {
    throw new AppError("Khoang thoi gian khong du de tao slot", 400);
  }

  return slots;
};

export const parseDateOnly = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError("Ngay phai co dinh dang YYYY-MM-DD", 400);
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError("Ngay khong hop le", 400);
  }

  return parsedDate;
};

export const getUtcDayOfWeek = (date: Date) => date.getUTCDay();

export const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const getVietnamNowParts = (now = new Date()) => {
  const vietnamNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  return {
    date: toDateOnly(vietnamNow),
    time: `${vietnamNow.getUTCHours().toString().padStart(2, "0")}:${vietnamNow
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`,
  };
};

export const isDateBeforeVietnamToday = (date: Date) =>
  toDateOnly(date) < getVietnamNowParts().date;

export const isSlotStartInPastVietnamTime = (date: Date, startTime: string) => {
  const now = getVietnamNowParts();
  const slotDate = toDateOnly(date);

  return (
    slotDate < now.date || (slotDate === now.date && startTime <= now.time)
  );
};

export const hasTimeOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) => {
  const a = validateTimeRange(startA, endA);
  const b = validateTimeRange(startB, endB);

  return a.start < b.end && b.start < a.end;
};

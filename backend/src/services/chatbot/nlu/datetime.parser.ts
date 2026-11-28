import type { ChatTimePeriod } from "../chatbot.types.js";
import { foldVietnamese } from "../rules/text-normalizer.js";

// Phân tích ngày giờ tiếng Việt bằng quy tắc, không cần AI: "ngày mai", "ngày kia", "thứ hai tuần sau", "25/11",
// "9 giờ sáng", "9h", "9h30", "9 giờ rưỡi", "2 giờ chiều", "buổi chiều", "sáng mai". Kết quả ở đây được ưu tiên hơn
// ngày giờ AI đoán (AI dễ tính sai thứ trong tuần); câu không có ngày giờ thì trả rỗng và AI không được bịa thêm.
// Mọi phép tính ngày dùng chuỗi YYYY-MM-DD theo giờ Việt Nam, truyền vào qua `today` để kiểm thử được.

export type ParsedDateTime = {
  date?: string;
  timePeriod?: ChatTimePeriod;
  /** Giờ cụ thể dạng HH:mm (24 giờ). */
  preferredTime?: string;
};

const pad = (value: number) => value.toString().padStart(2, "0");

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Thứ trong tuần theo cách nói tiếng Việt: thứ hai = 1 ... thứ bảy = 6, chủ nhật = 0 (giống getUTCDay). */
const WEEKDAYS: [RegExp, number][] = [
  [/\b(thu hai|thu 2|t2)\b/, 1],
  [/\b(thu ba|thu 3|t3)\b/, 2],
  [/\b(thu tu|thu 4|t4)\b/, 3],
  [/\b(thu nam|thu 5|t5)\b/, 4],
  [/\b(thu sau|thu 6|t6)\b/, 5],
  [/\b(thu bay|thu 7|t7)\b/, 6],
  [/\b(chu nhat|cn)\b/, 0],
];

const isValidDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const parseDate = (folded: string, today: string): string | undefined => {
  if (/\b(hom nay|ngay hom nay|(sang|trua|chieu|toi|dem) nay)\b/.test(folded)) return today;
  if (/\b(ngay kia|ngay mot|mai mot)\b/.test(folded)) return addDays(today, 2);
  // "mai" đứng một mình dễ trùng tên người (bác sĩ Mai): chỉ nhận khi đi với ngày/buổi hoặc đứng đầu câu.
  if (/\b(ngay mai|hom mai|(sang|trua|chieu|toi|dem|buoi) mai)\b|^mai\b/.test(folded)) return addDays(today, 1);

  // Ngày tháng viết số: 25/11, 25-11, 25/11/2026; hoặc "ngày 25 tháng 11", "ngày 25".
  const numeric = folded.match(/(?<![\d:])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?(?![\d:])/);
  const spoken = folded.match(/\bngay (\d{1,2})(?: thang (\d{1,2}))?(?: nam (\d{4}))?\b/);
  const parts = numeric || spoken;
  if (parts) {
    const [todayYear, todayMonth] = today.split("-").map(Number);
    const day = Number(parts[1]);
    const month = parts[2] ? Number(parts[2]) : todayMonth;
    let year = parts[3] ? Number(parts[3]) : todayYear;
    if (!isValidDate(year, month, day)) return undefined;
    let candidate = `${year}-${pad(month)}-${pad(day)}`;
    // Không nêu năm mà ngày đã qua: hiểu là lần tới (năm sau, hoặc tháng sau khi chỉ nêu ngày).
    if (!parts[3] && candidate < today) {
      if (parts[2]) year += 1;
      const nextMonth = parts[2] ? month : month === 12 ? 1 : month + 1;
      const nextYear = parts[2] ? year : month === 12 ? year + 1 : year;
      if (!isValidDate(nextYear, nextMonth, day)) return undefined;
      candidate = `${nextYear}-${pad(nextMonth)}-${pad(day)}`;
    }
    return candidate;
  }

  for (const [pattern, weekday] of WEEKDAYS) {
    if (!pattern.test(folded)) continue;
    const todayWeekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    // Tuần tính từ thứ hai. "tuần sau/tuần tới" là thứ đó của tuần kế tiếp; nói trống thì là ngày gần nhất từ hôm nay.
    if (/\btuan (sau|toi)\b/.test(folded)) {
      const mondayOffset = (todayWeekday + 6) % 7;
      const nextMonday = addDays(today, 7 - mondayOffset);
      return addDays(nextMonday, (weekday + 6) % 7);
    }
    return addDays(today, (weekday - todayWeekday + 7) % 7);
  }
  return undefined;
};

const periodOfHour = (hour: number): ChatTimePeriod => (hour < 12 ? "MORNING" : hour < 18 ? "AFTERNOON" : "EVENING");

// "sang" sau khi bỏ dấu trùng "sang" (đổi sang, chuyển sang): có dấu thì nhận chữ "sáng"; không dấu chỉ nhận cụm rõ nghĩa.
const parsePeriodWord = (lowered: string, folded: string): ChatTimePeriod | undefined => {
  const morning =
    /(^|[^\p{L}])sáng([^\p{L}]|$)/u.test(lowered) ||
    /\b(buoi sang|sang (mai|nay|som))\b|^sang\b|\d\s*(gio|h)(\s*\d{1,2}|\s*ruoi)?\s*sang\b/.test(folded);
  if (morning) return "MORNING";
  if (/\b(chieu|trua)\b/.test(folded)) return "AFTERNOON";
  if (/\b(buoi toi|toi (nay|mai)|ve dem|buoi dem)\b|\d\s*(gio|h)(\s*\d{1,2}|\s*ruoi)?\s*toi\b/.test(folded)) return "EVENING";
  return undefined;
};

const parseTime = (folded: string, period: ChatTimePeriod | undefined): string | undefined => {
  // 9h, 9h30, 9 gio, 9 gio 30, 9 gio ruoi, 14:30, 9g15. Không bắt số trong mã (BK2026...) hay ngày (25/11).
  const match = folded.match(/(?<![\d/.-])(\d{1,2})(?:\s*(?:gio|h|g)\s*(\d{1,2}|ruoi)?(?:\s*phut)?|:(\d{2}))(?![\d/])/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minutePart = match[2] ?? match[3];
  const minute = minutePart === "ruoi" ? 30 : minutePart ? Number(minutePart) : 0;
  if (hour > 23 || minute > 59) return undefined;
  if (period === "AFTERNOON" || period === "EVENING") {
    if (hour < 12) hour += 12;
  } else if (!period && hour >= 1 && hour <= 5) {
    // "2h", "3 giờ" không nói buổi: giờ khám là ban ngày nên hiểu là buổi chiều.
    hour += 12;
  }
  return `${pad(hour)}:${pad(minute)}`;
};

export const parseVietnameseDateTime = (message: string, today: string): ParsedDateTime => {
  const lowered = message.normalize("NFC").toLowerCase();
  const folded = foldVietnamese(message).replace(/[,.;!?]/g, " ").replace(/\s+/g, " ").trim();
  const result: ParsedDateTime = {};
  const date = parseDate(folded, today);
  if (date) result.date = date;
  const period = parsePeriodWord(lowered, folded);
  const time = parseTime(folded, period);
  if (time) {
    result.preferredTime = time;
    result.timePeriod = periodOfHour(Number(time.slice(0, 2)));
  } else if (period) {
    result.timePeriod = period;
  }
  return result;
};

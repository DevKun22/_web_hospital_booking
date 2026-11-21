import type { ContentSection, FaqEntry, TimelineEntry } from "@/lib/types";

// Làm sạch danh sách nội dung công khai trước khi gửi máy chủ: cắt khoảng trắng và bỏ dòng trống.
export const cleanStrings = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

export const cleanSections = (values: ContentSection[]) =>
  values.map((item) => ({ title: item.title.trim(), body: item.body.trim() })).filter((item) => item.title && item.body);

export const cleanTimeline = (values: TimelineEntry[]) =>
  values
    .map((item) => ({ period: item.period.trim(), place: item.place.trim(), ...(item.role?.trim() ? { role: item.role.trim() } : {}) }))
    .filter((item) => item.period && item.place);

export const cleanFaq = (values: FaqEntry[]) =>
  values.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })).filter((item) => item.question && item.answer);

import { z } from "zod";

// Nội dung công khai có cấu trúc: giới hạn số mục và độ dài để trang không bị phá bố cục và kho tri thức chatbot không phình.
const line = (max: number) => z.string().trim().min(1).max(max);

export const sectionsSchema = z
  .array(z.object({ title: line(80), body: z.string().trim().min(1).max(8000) }))
  .max(8);

export const stringListSchema = z.array(line(200)).max(12);

export const careerTimelineSchema = z
  .array(z.object({ period: line(40), place: line(160), role: z.string().trim().max(120).optional() }))
  .max(12);

export const faqSchema = z.array(z.object({ question: line(200), answer: z.string().trim().min(1).max(2000) })).max(10);

// Phần bác sĩ được tự soạn; học hàm học vị, chuyên khoa, phí khám, số năm kinh nghiệm do quản trị giữ.
export const doctorProfileContentFields = {
  bio: z.string().trim().max(4000).nullable().optional(),
  motto: z.string().trim().max(300).nullable().optional(),
  careerTimeline: careerTimelineSchema.optional(),
  memberships: stringListSchema.optional(),
  expertise: stringListSchema.optional(),
};

export const doctorProfileDraftSchema = z.object(doctorProfileContentFields).strict();

export type DoctorProfileContent = z.infer<typeof doctorProfileDraftSchema>;

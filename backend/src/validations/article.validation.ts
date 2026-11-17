import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const articleFields = {
  title: z.string("Tiêu đề là bắt buộc").trim().min(3, "Tiêu đề cần ít nhất 3 ký tự").max(200, "Tiêu đề tối đa 200 ký tự"),
  slug: z
    .string()
    .trim()
    .max(160)
    .regex(/^[a-z0-9-]*$/, "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang")
    .optional(),
  summary: optionalText(400),
  content: z.string("Nội dung là bắt buộc").trim().min(1, "Nội dung là bắt buộc").max(60_000, "Nội dung tối đa 60.000 ký tự"),
  category: optionalText(120),
  departmentId: z.string().uuid("Chuyên khoa không hợp lệ").nullable().optional(),
};

export const createArticleSchema = z.object(articleFields);

// Không dùng .partial() trên toàn bộ để các trường không gửi lên không bị ghi đè.
export const updateArticleSchema = z.object({
  title: articleFields.title.optional(),
  slug: articleFields.slug,
  summary: articleFields.summary,
  content: articleFields.content.optional(),
  category: articleFields.category,
  departmentId: articleFields.departmentId,
});

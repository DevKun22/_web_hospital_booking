import { z } from "zod";

// Nội dung để trống nghĩa là tắt văn bản đó (không còn đòi người khám đồng ý điều khoản).
const doc = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được trống").max(160),
  body: z.string().trim().max(60000),
});

export const updateLegalSchema = z
  .object({ terms: doc.optional(), privacy: doc.optional() })
  .refine((value) => value.terms !== undefined || value.privacy !== undefined, { message: "Chưa có nội dung nào để lưu" });

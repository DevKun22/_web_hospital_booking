import { z } from "zod";
import { sectionsSchema } from "./catalogContent.validation.js";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, "Ten chuyen khoa toi thieu 2 ky tu"),
  slug: z.string().trim().min(2, "Slug toi thieu 2 ky tu").optional(),
  description: z.string().trim().nullable().optional(),
  sections: sectionsSchema.optional(),
  contentReviewerName: z.string().trim().max(160).nullable().optional(),
  image: z
    .string()
    .trim()
    .url("Image phai la URL hop le")
    .nullable()
    .optional(),
  imageAssetId: z.string().uuid("Ảnh không hợp lệ").optional(),
  symptomKeywords: z.array(z.string().trim().min(2).max(80)).max(100).optional(),
  triageDescription: z.string().trim().max(500).nullable().optional(),
  isTriageFallback: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ten chuyen khoa toi thieu 2 ky tu")
    .optional(),
  slug: z
    .string()
    .trim()
    .min(2, "Slug toi thieu 2 ky tu")
    .nullable()
    .optional(),
  description: z.string().trim().nullable().optional(),
  sections: sectionsSchema.optional(),
  contentReviewerName: z.string().trim().max(160).nullable().optional(),
  image: z
    .string()
    .trim()
    .url("Image phai la URL hop le")
    .nullable()
    .optional(),
  imageAssetId: z.string().uuid("Ảnh không hợp lệ").nullable().optional(),
  symptomKeywords: z.array(z.string().trim().min(2).max(80)).max(100).optional(),
  triageDescription: z.string().trim().max(500).nullable().optional(),
  isTriageFallback: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

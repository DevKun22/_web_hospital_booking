import { z } from "zod";

const packageItemSchema = z.object({
  name: z.string().trim().min(2, "Ten hang muc toi thieu 2 ky tu"),
  description: z.string().trim().nullable().optional(),
  price: z.number().int().min(0, "Gia hang muc khong hop le").optional(),
  included: z.boolean().optional(),
  order: z.number().int().min(0, "Thu tu khong hop le").optional(),
});

export const createPackageSchema = z.object({
  name: z.string().trim().min(2, "Ten goi kham toi thieu 2 ky tu"),
  slug: z.string().trim().min(2, "Slug toi thieu 2 ky tu").optional(),
  description: z.string().trim().nullable().optional(),
  departmentId: z
    .string()
    .uuid("Chuyen khoa khong hop le")
    .nullable()
    .optional(),
  basePrice: z.number().int().min(0, "Gia goi khong hop le"),
  serviceFee: z.number().int().min(0, "Phi dich vu khong hop le").optional(),
  summary: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
  image: z.string().trim().url("Image phai la URL hop le").nullable().optional(),
  imageAssetId: z.string().uuid("Ảnh không hợp lệ").optional(),
  isPopular: z.boolean().optional(),
  isBHYTSupport: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z.array(packageItemSchema).optional(),
});

export const updatePackageSchema = z.object({
  name: z.string().trim().min(2, "Ten goi kham toi thieu 2 ky tu").optional(),
  slug: z
    .string()
    .trim()
    .min(2, "Slug toi thieu 2 ky tu")
    .nullable()
    .optional(),
  description: z.string().trim().nullable().optional(),
  departmentId: z
    .string()
    .uuid("Chuyen khoa khong hop le")
    .nullable()
    .optional(),
  basePrice: z.number().int().min(0, "Gia goi khong hop le").optional(),
  serviceFee: z.number().int().min(0, "Phi dich vu khong hop le").optional(),
  summary: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
  image: z.string().trim().url("Image phai la URL hop le").nullable().optional(),
  imageAssetId: z.string().uuid("Ảnh không hợp lệ").nullable().optional(),
  isPopular: z.boolean().optional(),
  isBHYTSupport: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const createPackageItemSchema = packageItemSchema;

export const updatePackageItemSchema = packageItemSchema.partial();

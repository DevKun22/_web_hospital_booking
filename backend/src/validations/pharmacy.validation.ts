import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => text(max).nullable().optional();
const positiveInt = z.number().int().positive().max(1_000_000);

export const createMedicineSchema = z.object({
  code: text(40).min(1, "Mã thuốc là bắt buộc"),
  name: text(200).min(1, "Tên thuốc là bắt buộc"),
  activeIngredient: nullableText(200),
  strength: nullableText(80),
  dosageForm: nullableText(80),
  unit: text(30).min(1, "Đơn vị là bắt buộc"),
  minStock: z.number().int().min(0).max(1_000_000).optional(),
  note: nullableText(500),
});

export const updateMedicineSchema = z.object({
  name: text(200).min(1).optional(),
  activeIngredient: nullableText(200),
  strength: nullableText(80),
  dosageForm: nullableText(80),
  unit: text(30).min(1).optional(),
  minStock: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  note: nullableText(500),
});

export const receiveStockSchema = z.object({
  quantity: positiveInt,
  reason: nullableText(300),
  // Khai cả hai hoặc không khai gì; hạn dùng theo YYYY-MM-DD.
  batchNumber: nullableText(60),
  expiryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/,"Hạn dùng phải có dạng YYYY-MM-DD")
    .nullable()
    .optional(),
});

export const adjustStockSchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  reason: text(300).min(1, "Điều chỉnh tồn kho phải có lý do"),
  // Điều chỉnh trong một lô cụ thể (ví dụ hủy lô hết hạn).
  batchId: z.string().uuid().nullable().optional(),
});

export const dispenseSchema = z.object({
  confirmed: z.boolean(),
  note: nullableText(500),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        medicineId: z.string().uuid().nullable().optional(),
      }),
    )
    .max(100)
    .optional(),
});

export const importCsvSchema = z.object({
  csv: z.string().min(1, "Tệp CSV trống").max(900_000, "Tệp CSV quá lớn"),
  apply: z.boolean().optional(),
});

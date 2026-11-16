import { z } from "zod";

const prescriptionItemSchema = z.object({
  medicineId: z.string().uuid("Ma thuoc khong hop le").nullable().optional(),
  medicineName: z.string().trim().min(2, "Ten thuoc toi thieu 2 ky tu"),
  dosage: z.string().trim().nullable().optional(),
  frequency: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  quantity: z
    .number()
    .int()
    .positive("So luong phai lon hon 0")
    .nullable()
    .optional(),
  unit: z.string().trim().nullable().optional(),
  instruction: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createPrescriptionSchema = z.object({
  note: z.string().trim().nullable().optional(),
  items: z.array(prescriptionItemSchema).optional().default([]),
});

export const updatePrescriptionSchema = z.object({
  note: z.string().trim().nullable().optional(),
});

export const createPrescriptionItemSchema = prescriptionItemSchema;

// Bác sĩ đánh dấu dòng thuốc của đơn đã phát hành mà kho không cấp được.
export const resolvePrescriptionItemSchema = z.object({
  status: z.enum(["OUTSIDE", "OUT_OF_STOCK"]),
  note: z.string().trim().max(200).nullable().optional(),
});

export const updatePrescriptionItemSchema = prescriptionItemSchema.partial();

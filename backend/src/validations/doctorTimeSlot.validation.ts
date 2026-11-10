import { z } from "zod";

export const generateDoctorTimeSlotsSchema = z.object({
  doctorId: z.string().uuid("Bac si khong hop le"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngay phai co dinh dang YYYY-MM-DD"),
});

export const updateDoctorTimeSlotStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "LOCKED", "CANCELLED"]),
  lockReason: z.string().trim().nullable().optional(),
});

export const lockDoctorTimeSlotSchema = z.object({
  lockReason: z.string().trim().min(2, "Ly do khoa slot toi thieu 2 ky tu"),
});

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngay phai co dinh dang YYYY-MM-DD");

export const generateRangeSchema = z.object({
  doctorId: z.string().uuid("Bac si khong hop le"),
  from: dateOnly,
  to: dateOnly,
});

export const closeRangeSchema = z.object({
  doctorId: z.string().uuid("Bac si khong hop le"),
  from: dateOnly,
  to: dateOnly,
  reason: z.string().trim().min(2, "Vui long nhap ly do nghi").max(200, "Ly do toi da 200 ky tu"),
});

export const reopenRangeSchema = z.object({
  doctorId: z.string().uuid("Bac si khong hop le"),
  from: dateOnly,
  to: dateOnly,
});

import { z } from "zod";
import { doctorProfileContentFields } from "./catalogContent.validation.js";

export const createDoctorProfileSchema = z.object({
  userId: z.string().uuid("User khong hop le"),
  departmentId: z.string().uuid("Chuyen khoa khong hop le"),
  title: z.string().trim().nullable().optional(),
  ...doctorProfileContentFields,
  specialization: z.string().trim().nullable().optional(),
  experience: z.number().int().min(0, "Kinh nghiem khong hop le").optional(),
  consultationFee: z.number().int().min(0, "Phi kham khong hop le").optional(),
  isAvailable: z.boolean().optional(),
});

export const updateDoctorProfileSchema = z.object({
  departmentId: z.string().uuid("Chuyen khoa khong hop le").optional(),
  title: z.string().trim().nullable().optional(),
  ...doctorProfileContentFields,
  specialization: z.string().trim().nullable().optional(),
  experience: z
    .number()
    .int()
    .min(0, "Kinh nghiem khong hop le")
    .nullable()
    .optional(),
  consultationFee: z.number().int().min(0, "Phi kham khong hop le").optional(),
  isAvailable: z.boolean().optional(),
});

export const updateDoctorAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

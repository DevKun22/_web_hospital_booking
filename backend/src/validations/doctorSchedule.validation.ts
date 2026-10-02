import { z } from "zod";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Thoi gian phai co dinh dang HH:mm");

export const createDoctorScheduleSchema = z.object({
  doctorId: z.string().uuid("Bac si khong hop le"),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  slotDuration: z.number().int().min(5).max(240).optional(),
  maxPatients: z.number().int().min(1).max(1).optional(),
  isActive: z.boolean().optional(),
});

export const updateDoctorScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  slotDuration: z.number().int().min(5).max(240).optional(),
  maxPatients: z.number().int().min(1).max(1).optional(),
  isActive: z.boolean().optional(),
});

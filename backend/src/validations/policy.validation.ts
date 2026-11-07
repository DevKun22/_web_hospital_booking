import { z } from "zod";

// Khoảng giá trị do PolicyService kiểm tra để trả lỗi nêu đích danh tham số.
export const updatePolicySchema = z.object({
  bookingHoldMinutes: z.number().int().optional(),
  reminderLeadMinutes: z.number().int().optional(),
  patientCancelCutoffHours: z.number().int().optional(),
  noShowGraceMinutes: z.number().int().optional(),
});

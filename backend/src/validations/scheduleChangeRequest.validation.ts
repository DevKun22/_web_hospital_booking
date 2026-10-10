import { z } from "zod";

const timeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
    "Thời gian phải có định dạng HH:mm",
  );
const dateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Ngày áp dụng phải có định dạng YYYY-MM-DD",
  );
const requestTypeSchema = z.enum([
  "CREATE_WEEKLY_SCHEDULE",
  "UPDATE_WEEKLY_SCHEDULE",
  "DEACTIVATE_WEEKLY_SCHEDULE",
]);

export const createScheduleChangeRequestSchema = z
  .object({
    type: requestTypeSchema,
    scheduleId: z
      .string()
      .uuid("Lịch mẫu không hợp lệ")
      .nullable()
      .optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
    slotDuration: z.number().int().min(5).max(240),
    maxPatients: z.number().int().min(1).max(1),
    isActive: z.boolean().optional(),
    effectiveFrom: dateSchema,
    reason: z
      .string()
      .trim()
      .min(
        5,
        "Lý do thay đổi tối thiểu 5 ký tự",
      )
      .max(500),
  })
  .superRefine((input, ctx) => {
    if (input.type !== "CREATE_WEEKLY_SCHEDULE" && !input.scheduleId) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduleId"],
        message:
          "Cần chọn lịch mẫu cần thay đổi",
      });
    }
  });

export const reviewScheduleChangeRequestSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    reviewerNote: z
      .string()
      .trim()
      .max(
        500,
        "Ghi chú duyệt không được vượt quá 500 ký tự",
      )
      .nullable()
      .optional(),
  })
  .superRefine((input, ctx) => {
    if (input.status === "REJECTED" && !input.reviewerNote) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewerNote"],
        message: "Cần nêu lý do từ chối",
      });
    }
  });

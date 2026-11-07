import { z } from "zod";

const ratingSchema = z
  .number()
  .int()
  .min(1, "Điểm đánh giá tối thiểu là 1 sao")
  .max(5, "Điểm đánh giá tối đa là 5 sao");

export const createAppointmentReviewSchema = z.object({
  doctorRating: ratingSchema,
  serviceRating: ratingSchema,
  facilityRating: ratingSchema,
  comment: z
    .string()
    .trim()
    .max(1000, "Nhận xét không được vượt quá 1000 ký tự")
    .nullable()
    .optional(),
});

export const updateReviewVisibilitySchema = z.object({
  isVisible: z.boolean(),
  moderationNote: z
    .string()
    .trim()
    .max(500, "Ghi chú kiểm duyệt không được vượt quá 500 ký tự")
    .nullable()
    .optional(),
});

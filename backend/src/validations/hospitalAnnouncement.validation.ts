import { z } from "zod";

const optionalIsoDate = z.string().datetime({ offset: true }).nullable().optional();

export const hospitalAnnouncementAudienceValues = [
  "ALL_PATIENTS",
  "UPCOMING_APPOINTMENTS",
  "DEPARTMENT_APPOINTMENTS",
] as const;

export const createHospitalAnnouncementSchema = z.object({
  title: z
    .string("Tiêu đề là bắt buộc")
    .trim()
    .min(3, "Tiêu đề cần ít nhất 3 ký tự")
    .max(120, "Tiêu đề tối đa 120 ký tự"),
  body: z
    .string("Nội dung là bắt buộc")
    .trim()
    .min(5, "Nội dung cần ít nhất 5 ký tự")
    .max(1000, "Nội dung tối đa 1000 ký tự"),
  scheduledAt: optionalIsoDate,
  expiresAt: optionalIsoDate,
  audience: z.enum(hospitalAnnouncementAudienceValues).default("ALL_PATIENTS"),
  departmentId: z.string().uuid().nullable().optional(),
}).superRefine((value, context) => {
  if (value.audience === "DEPARTMENT_APPOINTMENTS" && !value.departmentId) {
    context.addIssue({
      code: "custom",
      path: ["departmentId"],
      message: "Vui lòng chọn chuyên khoa cho nhóm người nhận này",
    });
  }
  if (value.audience !== "DEPARTMENT_APPOINTMENTS" && value.departmentId) {
    context.addIssue({
      code: "custom",
      path: ["departmentId"],
      message: "Chuyên khoa chỉ áp dụng cho nhóm có lịch theo chuyên khoa",
    });
  }
});

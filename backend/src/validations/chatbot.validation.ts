import { z } from "zod";

const boundedText = (max: number) => z.string().trim().max(max);
const shortList = z.array(boundedText(120)).max(10);
const MAX_ACTION_PAYLOAD_BYTES = 4 * 1024;

const actionPayloadSchema = z
  .record(z.string().max(80), z.unknown())
  .refine((value) => {
    try {
      return Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_ACTION_PAYLOAD_BYTES;
    } catch {
      return false;
    }
  }, "Payload thao tác quá lớn");

const draftSchema = z.object({
  departmentId: z.string().uuid("Chuyên khoa không hợp lệ").optional(),
  departmentSlug: boundedText(120).optional(),
  packageId: z.string().uuid("Gói khám không hợp lệ").optional(),
  packageSlug: boundedText(120).optional(),
  serviceMode: z.enum(["DOCTOR_ONLY", "PACKAGE"]).optional(),
  doctorId: z.string().uuid("Bác sĩ không hợp lệ").optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
    .optional(),
  timeSlotId: z.string().uuid("Khung giờ không hợp lệ").optional(),
  symptoms: shortList.optional(),
  bodyParts: shortList.optional(),
  symptomDuration: boundedText(80).optional(),
  symptomSeverity: z
    .enum(["MILD", "MODERATE", "SEVERE", "UNKNOWN"])
    .optional(),
  associatedSymptoms: shortList.optional(),
  triageLastQuestion: boundedText(300).optional(),
  reason: boundedText(500).optional(),
});

export const chatbotMessageSchema = z.object({
  sessionId: z.string().uuid("Session không hợp lệ").optional(),
  message: boundedText(2_000).min(1, "Tin nhắn không được để trống"),
  phone: boundedText(32).optional(),
  draft: draftSchema.optional(),
  action: z
    .object({
      type: boundedText(80).min(1, "Action type không được để trống"),
      label: boundedText(120).optional(),
      payload: actionPayloadSchema.optional(),
    })
    .optional(),
});

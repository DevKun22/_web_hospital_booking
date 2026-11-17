import { z } from "zod";
import { CHAT_OPERATIONS, CHAT_TIME_PERIODS } from "../chatbot.types.js";

const MISSING_DETAILS = ["DURATION", "SEVERITY", "BODY_PART", "ONSET", "SKIN_CHANGES", "ASSOCIATED_SYMPTOMS"] as const;
type MissingDetail = (typeof MISSING_DETAILS)[number];
const CLEAR_FIELDS = ["department", "package", "doctor", "date", "slot", "symptoms"] as const;
type ClearField = (typeof CLEAR_FIELDS)[number];

const optionalText = z.string().trim().min(1).max(160).optional().nullable();

export const nluResultSchema = z.object({
  operation: z.enum(CHAT_OPERATIONS).catch("UNKNOWN"),
  entities: z.object({
    departmentName: optionalText,
    packageName: optionalText,
    doctorName: optionalText,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    timePeriod: z.enum(CHAT_TIME_PERIODS).optional().nullable(),
    symptoms: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
    bodyParts: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
    duration: z.string().trim().min(1).max(80).optional().nullable(),
    severity: z
      .enum(["MILD", "MODERATE", "SEVERE", "UNKNOWN"])
      .optional()
      .nullable(),
    associatedSymptoms: z
      .array(z.string().trim().min(1).max(120))
      .max(10)
      .default([]),
    reason: optionalText,
  }).default({
    symptoms: [],
    bodyParts: [],
    associatedSymptoms: [],
  }),
  triage: z.object({
    summary: z.string().trim().min(1).max(240).optional().nullable(),
    clarificationQuestion: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .optional()
      .nullable(),
    // Mô hình đôi khi trả giá trị lạ; bỏ phần tử không hợp lệ thay vì hỏng cả kết quả phân tích.
    missingDetails: z.array(z.unknown()).max(12).default([]).transform((items) => items.filter((item): item is MissingDetail => (MISSING_DETAILS as readonly unknown[]).includes(item)).slice(0, 6)),
  }).default({ missingDetails: [] }),
  correction: z.object({
    clearFields: z.array(z.unknown()).max(12).default([]).transform((items) => items.filter((item): item is ClearField => (CLEAR_FIELDS as readonly unknown[]).includes(item)).slice(0, 6)),
  }).default({ clearFields: [] }),
  confidence: z.number().min(0).max(1).catch(0.5),
});

export type NLUResult = z.infer<typeof nluResultSchema>;
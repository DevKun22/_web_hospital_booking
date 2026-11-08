import { z } from "zod";
import { isAllowedMedicalFileUrl } from "../services/secureMedicalFile.service.js";

const medicalFileUrl = z
  .string()
  .trim()
  .url("File ket qua phai la URL hop le")
  .refine(isAllowedMedicalFileUrl, "File ket qua phai duoc tai len tu he thong (nguon luu tru cho phep)");

export const updateMedicalRecordSchema = z.object({
  symptoms: z.string().trim().nullable().optional(),
  diagnosis: z.string().trim().nullable().optional(),
  treatment: z.string().trim().nullable().optional(),
  prescription: z.string().trim().nullable().optional(),
  doctorNotes: z.string().trim().nullable().optional(),
  resultPdfUrl: medicalFileUrl.nullable().optional(),
});

export const createLabResultSchema = z.object({
  testName: z.string().trim().min(2, "Ten xet nghiem toi thieu 2 ky tu"),
  resultValue: z.string().trim().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  referenceRange: z.string().trim().nullable().optional(),
  conclusion: z.string().trim().nullable().optional(),
  fileUrl: medicalFileUrl.nullable().optional(),
});

export const updateLabResultSchema = createLabResultSchema.partial();

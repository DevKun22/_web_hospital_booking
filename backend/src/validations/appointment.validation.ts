import { z } from "zod";

const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngay phai co dinh dang YYYY-MM-DD");

export const createAppointmentSchema = z.object({
  dependentProfileId: z.string().uuid("Hồ sơ người thân không hợp lệ").nullable().optional(),
  packageId: z.string().uuid("Goi kham khong hop le").nullable().optional(),
  departmentId: z.string().uuid("Chuyen khoa khong hop le"),
  doctorId: z.string().uuid("Bac si khong hop le"),
  timeSlotId: z.string().uuid("Khung gio khong hop le"),

  patientName: z.string().trim().min(2, "Ho ten toi thieu 2 ky tu"),
  patientPhone: z.string().regex(phoneRegex, "So dien thoai khong hop le"),
  patientEmail: z.string().trim().email("Email khong hop le").nullable().optional(),
  otpChannel: z.enum(["SMS", "EMAIL"]).default("SMS"),
  reason: z.string().trim().nullable().optional(),

  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
  dateOfBirth: dateOnlySchema.nullable().optional(),
  cccd: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),

  hasBHYT: z.boolean().optional(),
  healthInsuranceCode: z.string().trim().nullable().optional(),
  registeredHospital: z.string().trim().nullable().optional(),
  allergies: z.string().trim().nullable().optional(),
  medicalHistory: z.string().trim().nullable().optional(),
  familyHistory: z.string().trim().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.otpChannel === "EMAIL" && !value.patientEmail) {
    ctx.addIssue({
      code: "custom",
      path: ["patientEmail"],
      message: "Email la bat buoc khi chon xac thuc OTP qua email",
    });
  }
});

export const verifyAppointmentOtpSchema = z.object({
  otp: z.string().length(6, "OTP phai co 6 so").regex(/^[0-9]+$/, "OTP chi duoc chua so"),
});

export const abandonPendingAppointmentSchema = z.object({
  holdReleaseToken: z.string().trim().min(32, "Quyen huy giu lich khong hop le"),
});

export const requestAppointmentLookupOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, "So dien thoai khong hop le"),
  bookingCode: z.string().trim().min(1, "Ma lich hen khong hop le").optional(),
});

export const verifyAppointmentLookupOtpSchema = z.object({
  phone: z.string().regex(phoneRegex, "So dien thoai khong hop le"),
  bookingCode: z.string().trim().min(1, "Ma lich hen khong hop le").optional(),
  otp: z.string().length(6, "OTP phai co 6 so").regex(/^[0-9]+$/, "OTP chi duoc chua so"),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(2, "Ly do huy toi thieu 2 ky tu"),
});

export const rescheduleAppointmentSchema = z.object({
  timeSlotId: z.string().uuid("Khung gio khong hop le"),
  reason: z.string().trim().min(2, "Ly do doi lich toi thieu 2 ky tu"),
});

export const requestPublicCancelAppointmentOtpSchema = z.object({
  bookingCode: z.string().trim().min(1, "Ma lich hen la bat buoc"),
  phone: z.string().regex(phoneRegex, "So dien thoai khong hop le"),
  reason: z.string().trim().min(2, "Ly do huy toi thieu 2 ky tu"),
});

export const verifyPublicCancelAppointmentSchema = requestPublicCancelAppointmentOtpSchema.extend({
  otp: z.string().length(6, "OTP phai co 6 so").regex(/^[0-9]+$/, "OTP chi duoc chua so"),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"]),
});

export const updateAppointmentPatientInfoSchema = z.object({
  patientName: z.string().trim().min(2, "Ho ten toi thieu 2 ky tu").optional(),
  patientEmail: z.string().trim().email("Email khong hop le").nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
  dateOfBirth: dateOnlySchema.nullable().optional(),
  cccd: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  hasBHYT: z.boolean().optional(),
  healthInsuranceCode: z.string().trim().nullable().optional(),
  registeredHospital: z.string().trim().nullable().optional(),
  allergies: z.string().trim().nullable().optional(),
  medicalHistory: z.string().trim().nullable().optional(),
  familyHistory: z.string().trim().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.hasBHYT === true && !value.healthInsuranceCode?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["healthInsuranceCode"],
      message: "Ma the BHYT la bat buoc khi benh nhan co BHYT",
    });
  }
});

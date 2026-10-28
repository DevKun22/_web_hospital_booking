import { z } from "zod";

const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
const optionalDevice = {
  deviceId: z.string().trim().min(1).max(128).optional(),
  deviceName: z.string().trim().min(1).max(128).optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
  appVersion: z.string().trim().min(1).max(40).optional(),
};

export const patientRequestOtpSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, "Số điện thoại không hợp lệ"),
});

export const patientVerifyOtpSchema = z.object({
  challengeId: z.string().uuid("Challenge không hợp lệ"),
  otp: z.string().regex(/^\d{6}$/, "OTP phải có 6 chữ số"),
  ...optionalDevice,
});

export const patientRefreshSchema = z.object({
  refreshToken: z.string().min(32, "Refresh token không hợp lệ"),
  ...optionalDevice,
});

export const patientLogoutSchema = z.object({
  refreshToken: z.string().min(32, "Refresh token không hợp lệ"),
});

export const patientPushTokenSchema = z.object({
  pushToken: z.string().trim().min(20).max(4096),
  platform: z.enum(["android", "ios"]),
  appVersion: z.string().trim().min(1).max(40).optional(),
});

export const patientProfileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().nullable().optional(),
    dateOfBirth: z.string().date().nullable().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
    cccd: z.string().trim().min(9).max(20).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    hasBHYT: z.boolean().optional(),
    healthInsuranceCode: z.string().trim().max(50).nullable().optional(),
    registeredHospital: z.string().trim().max(200).nullable().optional(),
    bloodType: z.string().trim().max(10).nullable().optional(),
    height: z.number().positive().max(300).nullable().optional(),
    weight: z.number().positive().max(500).nullable().optional(),
    allergies: z.string().trim().max(2000).nullable().optional(),
    medicalHistory: z.string().trim().max(5000).nullable().optional(),
    familyHistory: z.string().trim().max(5000).nullable().optional(),
    bloodPressure: z.string().trim().max(40).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần ít nhất một trường để cập nhật",
  });

export const patientCancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const dependentFields = {
  fullName: z.string().trim().min(2).max(120),
  relationship: z.enum(["CHILD", "SPOUSE", "PARENT", "SIBLING", "OTHER"]),
  phone: z.string().trim().regex(phoneRegex, "Số điện thoại không hợp lệ").nullable().optional(),
  email: z.string().trim().email("Email không hợp lệ").nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
  cccd: z.string().trim().min(9).max(20).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  hasBHYT: z.boolean().optional(),
  healthInsuranceCode: z.string().trim().max(50).nullable().optional(),
  registeredHospital: z.string().trim().max(200).nullable().optional(),
  allergies: z.string().trim().max(2000).nullable().optional(),
  medicalHistory: z.string().trim().max(5000).nullable().optional(),
  familyHistory: z.string().trim().max(5000).nullable().optional(),
};

const validateDependentInsurance = (
  value: { hasBHYT?: boolean; healthInsuranceCode?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (value.hasBHYT === true && !value.healthInsuranceCode?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["healthInsuranceCode"],
      message: "Mã thẻ BHYT là bắt buộc khi người thân có BHYT",
    });
  }
};

export const patientDependentCreateSchema = z
  .object({
    ...dependentFields,
    consentConfirmed: z.literal(true, {
      error: "Bạn cần xác nhận quyền quản lý hồ sơ người thân",
    }),
  })
  .superRefine(validateDependentInsurance);

export const patientDependentUpdateSchema = z
  .object({
    ...dependentFields,
    fullName: dependentFields.fullName.optional(),
    relationship: dependentFields.relationship.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần ít nhất một trường để cập nhật",
  })
  .superRefine(validateDependentInsurance);

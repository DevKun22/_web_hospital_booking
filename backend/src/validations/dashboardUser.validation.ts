import { z } from "zod";

const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;

const dashboardRoleSchema = z.enum(["ADMIN", "STAFF", "DOCTOR", "PHARMACIST"]);

export const createDashboardUserSchema = z.object({
  fullName: z.string().trim().min(2, "Ho ten toi thieu 2 ky tu"),
  // Email là định danh đăng nhập và nơi nhận OTP; số điện thoại chỉ là thông tin liên hệ.
  email: z.string().trim().toLowerCase().email("Email khong hop le"),
  phone: z.string().regex(phoneRegex, "So dien thoai khong hop le").optional(),
  password: z.string().min(6, "Mat khau toi thieu 6 ky tu"),
  role: dashboardRoleSchema,
  avatar: z.string().trim().url("Avatar phai la URL hop le").optional(),
  avatarAssetId: z.string().uuid("Avatar khong hop le").optional(),
  isActive: z.boolean().optional(),
});

export const updateDashboardUserSchema = z.object({
  fullName: z.string().trim().min(2, "Ho ten toi thieu 2 ky tu").optional(),
  email: z.string().trim().toLowerCase().email("Email khong hop le").optional(),
  phone: z.string().regex(phoneRegex, "So dien thoai khong hop le").nullable().optional(),
  role: dashboardRoleSchema.optional(),
  avatar: z
    .string()
    .trim()
    .url("Avatar phai la URL hop le")
    .nullable()
    .optional(),
  avatarAssetId: z.string().uuid("Avatar khong hop le").nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateDashboardUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateDashboardUserPasswordSchema = z.object({
  password: z.string().min(6, "Mat khau toi thieu 6 ky tu"),
});

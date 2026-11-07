import { z } from "zod";

// Ví dụ: { "record.view": ["DOCTOR", "ADMIN"] }. Mã quyền và vai trò hợp lệ do
// RbacService kiểm tra theo eligibleRoles để trả lỗi nêu đích danh.
export const updateRbacMatrixSchema = z.object({
  grants: z.record(z.string().min(1).max(60), z.array(z.string().min(1).max(30)).max(10)),
});

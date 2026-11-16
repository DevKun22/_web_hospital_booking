import type { Role } from "../../generated/prisma/enums.js";

/** Người thực hiện thao tác (lấy từ phiên đăng nhập) để ghi nhật ký và kiểm quyền theo dữ liệu. */
export type Actor = { userId: string; role: Role };

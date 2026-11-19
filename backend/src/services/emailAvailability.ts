import { logger } from "../observability/logger.js";
import { AppError } from "../utils/appError.js";
import { maskEmail } from "../config/otpChannels.js";

// Email là định danh duy nhất của một tài khoản, nên có email không dùng được cho cổng người khám (thuộc nhân sự, hoặc tài khoản người
// khám bị khóa). Thông báo cho người dùng cố ý TRUNG TÍNH: không nói email thuộc tài khoản nội bộ hay đã bị khóa, vì đó là thông tin
// người lạ có thể dò từng email một. Lý do thật chỉ ghi vào nhật ký máy chủ (email đã che) để đội vận hành tra cứu.
export type EmailUnavailableReason = "STAFF_ACCOUNT" | "PATIENT_DISABLED";

export const EMAIL_UNAVAILABLE_CODE = "EMAIL_UNAVAILABLE";
export const EMAIL_UNAVAILABLE_MESSAGE =
  "Email này không dùng được để đặt lịch hoặc đăng nhập người khám. Vui lòng dùng email khác hoặc liên hệ cơ sở khám nếu cần hỗ trợ.";

export const emailUnavailableError = (email: string, reason: EmailUnavailableReason) => {
  logger.warn(`[EMAIL_UNAVAILABLE] reason=${reason} email=${maskEmail(email)}`);
  return new AppError(EMAIL_UNAVAILABLE_MESSAGE, 409, EMAIL_UNAVAILABLE_CODE);
};

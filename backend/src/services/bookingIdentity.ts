import type { OtpChannel } from "../../generated/prisma/enums.js";

// Quy tắc định danh khi KHÁCH (chưa đăng nhập) đặt lịch bằng số điện thoại.
//
// Tài khoản người khám được định danh theo số điện thoại, nhưng OTP đặt lịch
// có thể chỉ xác thực EMAIL (chưa có nhà cung cấp SMS). Email do người đặt tự
// nhập, nên xác thực email KHÔNG chứng minh người đó sở hữu số điện thoại.
// Nếu cho phép, kẻ đặt lịch bằng SĐT của người khác cùng email của mình sẽ gắn
// email đó vào tài khoản nạn nhân rồi đăng nhập bằng email. Hàm dưới đây quyết
// định khi nào được gắn lịch hẹn và ghi dữ liệu xác thực vào tài khoản đã có.

export type ExistingPatientAccount = {
  email: string | null;
  isPhoneVerified: boolean;
};

export type GuestBookingIdentityDecision =
  // Chưa có tài khoản cho SĐT này: tạo mới.
  | "NEW_ACCOUNT"
  // OTP gửi qua SMS nên chính người nhận mã đã chứng minh sở hữu SĐT.
  | "PHONE_PROVEN_BY_SMS"
  // Email đặt lịch trùng email đã gắn với tài khoản: chủ tài khoản.
  | "SAME_EMAIL_OWNER"
  // Tài khoản trống (chưa email, chưa từng xác thực): được nhận email này.
  | "UNCLAIMED_ACCOUNT"
  // Tài khoản đã có chủ khác: phải đăng nhập mới đặt được.
  | "LOGIN_REQUIRED";

export const ACCOUNT_LOGIN_REQUIRED_CODE = "ACCOUNT_LOGIN_REQUIRED";
export const ACCOUNT_LOGIN_REQUIRED_MESSAGE =
  "Số điện thoại này đã có tài khoản. Vui lòng đăng nhập cổng bệnh nhân để đặt lịch.";

const normalizeEmail = (value?: string | null) =>
  value?.trim().toLowerCase() || "";

export const decideGuestBookingIdentity = (input: {
  channel: OtpChannel;
  existing: ExistingPatientAccount | null;
  bookingEmail?: string | null;
}): GuestBookingIdentityDecision => {
  if (!input.existing) return "NEW_ACCOUNT";

  if (input.channel === "SMS") return "PHONE_PROVEN_BY_SMS";

  const accountEmail = normalizeEmail(input.existing.email);
  if (accountEmail && accountEmail === normalizeEmail(input.bookingEmail)) {
    return "SAME_EMAIL_OWNER";
  }

  if (!accountEmail && !input.existing.isPhoneVerified) {
    return "UNCLAIMED_ACCOUNT";
  }

  return "LOGIN_REQUIRED";
};

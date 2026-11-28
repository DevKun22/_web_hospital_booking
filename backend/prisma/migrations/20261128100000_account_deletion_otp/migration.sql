-- Mục đích OTP mới cho người khám tự xóa tài khoản (chỉ thêm giá trị, không đổi dữ liệu).
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETION';

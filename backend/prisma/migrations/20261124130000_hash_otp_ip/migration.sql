-- IP trong mã OTP và khóa tạm giờ lưu dạng dấu vân tay HMAC (tính trong ứng dụng, cần khóa bí mật nên không đổi được bằng SQL).
-- Dữ liệu cũ dạng rõ chỉ phục vụ giới hạn trong 15-30 phút gần nhất: xóa đi thay vì giữ IP dạng rõ.
UPDATE "OtpCode" SET "ipAddress" = NULL WHERE "ipAddress" IS NOT NULL;
DELETE FROM "OtpSecurityBlock" WHERE "targetType" = 'IP';

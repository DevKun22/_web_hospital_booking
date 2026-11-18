import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { resolveOtpSecret } from "../config/environment.js";

// Mã OTP đi vào dữ liệu job BullMQ (lưu trong Redis, job lỗi giữ nhiều giờ). Niêm phong bằng AES-256-GCM để Redis không
// bao giờ chứa mã chữ rõ; khóa dẫn xuất từ OTP_SECRET nên chỉ tiến trình có bí mật này mới mở được.
const deriveKey = () => createHash("sha256").update("otp-job-seal:" + resolveOtpSecret()).digest();

export const sealOtp = (otp: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(otp, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
};

export const unsealOtp = (sealed: string) => {
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length < 12 + 16 + 1) throw new Error("Dữ liệu OTP trong job không hợp lệ");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
};

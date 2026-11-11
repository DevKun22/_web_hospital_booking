import type { OtpChannel } from "../../generated/prisma/enums.js";
import { isProductionLike } from "./environment.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

// Nguồn sự thật duy nhất về kênh OTP đang dùng được. Backend, web và mobile
// (qua /api/v1/capabilities) cùng dựa vào đây để không hiện kênh không gửi được.

export const normalizeVietnamPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
};

export const getSmsProvider = () =>
  getRuntimeConfig().otp.smsProvider;

export const isSmsProviderConfigured = () =>
  getSmsProvider() === "textbee" &&
  Boolean(getRuntimeConfig().otp.textbeeApiKey) &&
  Boolean(getRuntimeConfig().otp.textbeeDeviceId);

// Local/dev: OTP_DEBUG_ENABLED in OTP ra log và trả debugOtp cho mọi số.
export const isLocalOtpDebugEnabled = () =>
  !isProductionLike() && getRuntimeConfig().otp.debugEnabled;

// Demo trước hội đồng: chỉ các số trong DEMO_OTP_PHONES được nhận OTP SMS
// hiển thị trên màn hình, kể cả khi deploy production. Số thật khác không bị ảnh hưởng.
const getDemoOtpPhones = () =>
  new Set(
    getRuntimeConfig().otp.demoPhones
      .map((item) => normalizeVietnamPhone(item))
      .filter(Boolean),
  );

export const isDemoOtpPhone = (target: string) =>
  getDemoOtpPhones().has(normalizeVietnamPhone(target));

export const shouldExposeDebugOtp = (channel: OtpChannel, target: string) =>
  isLocalOtpDebugEnabled() || (channel === "SMS" && isDemoOtpPhone(target));

export const canDeliverSms = (target?: string) =>
  isSmsProviderConfigured() ||
  isLocalOtpDebugEnabled() ||
  (target ? isDemoOtpPhone(target) : false);

export const isEmailOtpConfigured = () =>
  Boolean(getRuntimeConfig().otp.resendApiKey) || !isProductionLike();

// Kênh hiển thị cho người dùng phổ thông (không tính số demo).
export const getOtpCapabilities = () => {
  const channels: OtpChannel[] = [];
  if (isEmailOtpConfigured()) channels.push("EMAIL");
  if (isSmsProviderConfigured() || isLocalOtpDebugEnabled()) channels.push("SMS");
  return {
    channels,
    defaultChannel: (channels[0] || "EMAIL") as OtpChannel,
  };
};

export const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 3))}@${domain}`;
};

export const maskPhone = (phone: string) =>
  phone.length > 4 ? `${"*".repeat(phone.length - 3)}${phone.slice(-3)}` : phone;

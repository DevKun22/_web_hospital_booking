import { isProductionLike } from "./environment.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

// OTP chỉ gửi qua email. Backend, web và mobile (qua /api/v1/capabilities) cùng dựa vào đây để biết OTP có gửi được không.

// Local/dev: OTP_DEBUG_ENABLED in OTP ra log và trả debugOtp cho mọi email.
export const isLocalOtpDebugEnabled = () =>
  !isProductionLike() && getRuntimeConfig().otp.debugEnabled;

export const shouldExposeDebugOtp = () => isLocalOtpDebugEnabled();

export const isEmailOtpConfigured = () =>
  Boolean(getRuntimeConfig().otp.resendApiKey) || !isProductionLike();

export const getOtpCapabilities = () => ({ emailOtpAvailable: isEmailOtpConfigured() });

export const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 3))}@${domain}`;
};

export const maskPhone = (phone: string) =>
  phone.length > 4 ? `${"*".repeat(phone.length - 3)}${phone.slice(-3)}` : phone;

import { AppError } from "../utils/appError.js";
import { getSmsProvider } from "../config/otpChannels.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";

// Adapter gửi SMS. Hiện hỗ trợ TextBee (gateway Android); có thể thêm
// eSMS/SpeedSMS... bằng cách viết thêm một nhánh cùng chữ ký sendSms.

const toE164Vietnam = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+${digits}`;
};

const sendViaTextbee = async (to: string, message: string) => {
  const { baseUrl, deviceId, apiKey } = getRuntimeConfig().sms;
  if (!deviceId || !apiKey) {
    throw new AppError("Chưa cấu hình TEXTBEE_API_KEY / TEXTBEE_DEVICE_ID", 500);
  }

  const response = await fetch(
    `${baseUrl}/api/v1/gateway/devices/${encodeURIComponent(deviceId)}/send-sms`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ recipients: [toE164Vietnam(to)], message }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError(
      `TextBee trả về lỗi HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      502,
    );
  }
};

export const sendSms = async (to: string, message: string) => {
  const provider = getSmsProvider();
  if (provider === "textbee") return sendViaTextbee(to, message);
  throw new AppError("Chưa cấu hình nhà cung cấp SMS", 500, "SMS_PROVIDER_UNAVAILABLE");
};

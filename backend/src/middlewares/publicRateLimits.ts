import { getClientIp } from "../utils/clientIp.js";
import { rateLimit } from "./rateLimit.middleware.js";

// Chính sách giới hạn cho các endpoint công khai tốn tài nguyên. Các endpoint
// OTP và đăng nhập đã có giới hạn riêng trong AuthOtpService / dashboardLoginSecurity.

const MINUTE_MS = 60_000;

const bodyEmail = (body: unknown) => {
  const value = (body as { patientEmail?: unknown } | undefined)?.patientEmail;
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") && email.length >= 5 ? email : null;
};

// Đặt lịch giữ slot trong thời gian chờ OTP, nên cần chặn việc giữ hàng loạt.
export const bookingCreateIpLimiter = rateLimit({
  name: "booking-create-ip",
  windowMs: 10 * MINUTE_MS,
  max: 10,
  degraded: { mode: "enforce", max: 5 },
  failureMode: "deny",
  key: (req) => getClientIp(req),
  message:
    "Bạn đã gửi quá nhiều yêu cầu đặt lịch. Vui lòng thử lại sau ít phút.",
});

export const bookingCreateEmailLimiter = rateLimit({
  name: "booking-create-email",
  windowMs: 10 * MINUTE_MS,
  max: 5,
  degraded: { mode: "enforce", max: 3 },
  failureMode: "deny",
  key: (req) => bodyEmail(req.body),
  message:
    "Email này đã đặt lịch quá nhiều lần. Vui lòng thử lại sau ít phút.",
});

export const searchLimiter = rateLimit({
  name: "search",
  windowMs: MINUTE_MS,
  max: 60,
  degraded: { mode: "allow" },
  key: (req) => getClientIp(req),
});

// Chatbot gọi mô hình AI có chi phí, giới hạn chặt hơn tìm kiếm.
export const chatbotMessageLimiter = rateLimit({
  name: "chatbot-message",
  windowMs: MINUTE_MS,
  max: 30,
  degraded: { mode: "enforce", max: 10 },
  failureMode: "deny",
  key: (req) => getClientIp(req),
});

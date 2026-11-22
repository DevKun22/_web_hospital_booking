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

// Giới hạn tần suất tạo lịch chỉ là lưới chặn lũ yêu cầu (tự động hóa, dò email), KHÔNG phải cách chặn việc giữ chỗ hàng loạt: việc
// đó do trần số lịch đang chờ OTP theo email (MAX_OPEN_HOLDS_PER_EMAIL) và việc nhả chỗ khi hết hạn giữ. Mọi yêu cầu đều bị tính, kể
// cả lần bị từ chối, vì lần bị từ chối chính là phép dò email; nên ngưỡng phải đủ rộng để người dùng đúng quy trình (sửa thông tin, đổi
// giờ, thử lại) không chạm tới, và IP chung của một cơ sở khám (nhiều người cùng mạng) không bị khóa lẫn nhau.
export const bookingCreateIpLimiter = rateLimit({
  name: "booking-create-ip",
  windowMs: 10 * MINUTE_MS,
  max: 30,
  degraded: { mode: "enforce", max: 15 },
  failureMode: "deny",
  key: (req) => getClientIp(req),
  message: "Có quá nhiều yêu cầu đặt lịch từ mạng của bạn. Vui lòng thử lại sau ít phút.",
});

export const bookingCreateEmailLimiter = rateLimit({
  name: "booking-create-email",
  windowMs: 10 * MINUTE_MS,
  max: 10,
  degraded: { mode: "enforce", max: 6 },
  failureMode: "deny",
  key: (req) => bodyEmail(req.body),
  message: "Có quá nhiều yêu cầu đặt lịch với email này. Vui lòng thử lại sau ít phút.",
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const chatbotSessionKey = (req: { body?: unknown }) => {
  const value = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
};

// Giới hạn theo phiên trò chuyện, bên cạnh giới hạn theo IP: một phiên không thể dồn nhiều lượt gọi AI trong thời gian ngắn,
// và có trần mỗi ngày. Tin đầu tiên chưa có sessionId nên chỉ chịu giới hạn theo IP.
export const chatbotSessionBurstLimiter = rateLimit({
  name: "chatbot-session-burst",
  windowMs: MINUTE_MS,
  max: 12,
  degraded: { mode: "enforce", max: 6 },
  failureMode: "deny",
  key: chatbotSessionKey,
  message: "Bạn nhắn hơi nhanh, đợi một lát rồi hỏi tiếp nhé.",
});

export const chatbotSessionDailyLimiter = rateLimit({
  name: "chatbot-session-daily",
  windowMs: 24 * 60 * MINUTE_MS,
  max: 300,
  degraded: { mode: "enforce", max: 150 },
  failureMode: "deny",
  key: chatbotSessionKey,
  message: "Phiên trò chuyện này đã đạt giới hạn trong ngày. Bạn thử lại vào ngày mai hoặc nhờ nhân viên hỗ trợ nhé.",
});

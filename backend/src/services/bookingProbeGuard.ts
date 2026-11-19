import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import AuthAttemptService, { fingerprint } from "./authAttempt.service.js";

// Chống dò email qua form đặt lịch. Email nhân sự hoặc tài khoản khóa nhận thông báo trung tính (không nói lý do), nhưng nếu một IP liên
// tiếp gặp thông báo đó thì chính là dấu hiệu dò từng email. Ghi lại mỗi lần và chặn IP sau vài lần: người dùng thật gần như không bao giờ
// gặp, còn dò hàng loạt thì không còn khả thi. Cửa sổ trượt: lượt cũ nhất hết hạn thì được thử lại.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PROBES_PER_WINDOW = 5;

export const BLOCKED_MESSAGE = "Có quá nhiều yêu cầu đặt lịch từ mạng của bạn. Vui lòng thử lại sau.";

const BookingProbeGuard = {
  // Gọi đầu mỗi lượt đặt lịch: IP đã bị chặn thì từ chối sớm, trước mọi truy vấn nặng.
  async assertNotBlocked(ipAddress: string | undefined) {
    if (!ipAddress) return;
    const where = {
      kind: "BOOKING_EMAIL_PROBE" as const,
      success: false,
      ipKey: fingerprint("ip", ipAddress),
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
    };
    const count = await prisma.authAttempt.count({ where });
    if (count < MAX_PROBES_PER_WINDOW) return;

    const oldest = await prisma.authAttempt.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
    const retryAfterSeconds = oldest
      ? Math.max(Math.ceil((oldest.createdAt.getTime() + WINDOW_MS - Date.now()) / 1000), 1)
      : Math.ceil(WINDOW_MS / 1000);
    throw new AppError(BLOCKED_MESSAGE, 429, "RATE_LIMITED", { retryAfterSeconds });
  },

  async recordUnavailable(email: string, ipAddress: string | undefined) {
    await AuthAttemptService.record({ kind: "BOOKING_EMAIL_PROBE", target: email, ipAddress, success: false });
  },
};

export default BookingProbeGuard;

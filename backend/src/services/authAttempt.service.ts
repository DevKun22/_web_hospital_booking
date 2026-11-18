import { createHmac } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { resolveOtpSecret } from "../config/environment.js";
import type { AuthAttemptKind, OtpPurpose } from "../../generated/prisma/enums.js";

// Bộ đếm lượt thử xác thực dùng chung cho nhập OTP và đăng nhập bảng điều khiển, để giới hạn dò mã và mật khẩu trên mọi
// instance backend. Đích (email) và IP lưu dạng băm HMAC, không lưu dạng rõ. Dữ liệu ngắn hạn, dọn định kỳ.

const SECURITY_SECRET = resolveOtpSecret();
const RETENTION_DAYS = 30;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

export const fingerprint = (namespace: "target" | "ip", value: string) =>
  createHmac("sha256", SECURITY_SECRET)
    .update(`${namespace}:${value.trim().toLowerCase()}`)
    .digest("hex");

type AttemptScope = {
  kind: AuthAttemptKind;
  // Lọc thêm theo mục đích OTP (chỉ có ở OTP_VERIFY).
  purpose?: OtpPurpose;
};

class AuthAttemptService {
  private lastCleanupAt = 0;

  async record(input: AttemptScope & { target: string; ipAddress?: string; success: boolean }) {
    await prisma.authAttempt.create({
      data: {
        kind: input.kind,
        targetKey: fingerprint("target", input.target),
        ipKey: input.ipAddress ? fingerprint("ip", input.ipAddress) : null,
        purpose: input.purpose,
        success: input.success,
      },
    });
    await this.cleanupIfDue();
  }

  // Số lần thất bại trong cửa sổ thời gian, theo đích và theo IP.
  async countFailures(input: AttemptScope & { target: string; ipAddress?: string; windowMs: number }) {
    const createdAt = { gte: new Date(Date.now() - input.windowMs) };
    const base = { kind: input.kind, success: false, createdAt };
    const [byTarget, byIp] = await Promise.all([
      prisma.authAttempt.count({
        where: { ...base, targetKey: fingerprint("target", input.target), purpose: input.purpose },
      }),
      input.ipAddress
        ? prisma.authAttempt.count({ where: { ...base, ipKey: fingerprint("ip", input.ipAddress) } })
        : Promise.resolve(0),
    ]);
    return { byTarget, byIp };
  }

  async clearTarget(kind: AuthAttemptKind, target: string) {
    await prisma.authAttempt.deleteMany({
      where: { kind, targetKey: fingerprint("target", target) },
    });
  }

  private async cleanupIfDue() {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_EVERY_MS) return;
    this.lastCleanupAt = now;

    await prisma.authAttempt.deleteMany({
      where: { createdAt: { lt: new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  }
}

export default new AuthAttemptService();

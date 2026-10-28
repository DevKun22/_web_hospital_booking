import { createHmac } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { resolveOtpSecret } from "../config/environment.js";
import { AppError } from "../utils/appError.js";

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_IP = 20;
const RETENTION_DAYS = 30;
const SECURITY_SECRET = resolveOtpSecret();

const fingerprint = (namespace: "target" | "ip", value: string) =>
  createHmac("sha256", SECURITY_SECRET)
    .update(`${namespace}:${value.trim().toLowerCase()}`)
    .digest("hex");

const windowStart = () =>
  new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

class DashboardLoginSecurityService {
  private lastCleanupAt = 0;

  private keys(phone: string, ipAddress: string) {
    return {
      targetHash: fingerprint("target", phone),
      ipHash: fingerprint("ip", ipAddress),
    };
  }

  async assertAllowed(phone: string, ipAddress: string) {
    const { targetHash, ipHash } = this.keys(phone, ipAddress);
    const createdAt = { gte: windowStart() };
    const [accountFailures, ipFailures] = await Promise.all([
      prisma.dashboardLoginFailure.count({
        where: { targetHash, createdAt },
      }),
      prisma.dashboardLoginFailure.count({
        where: { ipHash, createdAt },
      }),
    ]);

    if (
      accountFailures >= MAX_FAILURES_PER_ACCOUNT ||
      ipFailures >= MAX_FAILURES_PER_IP
    ) {
      throw new AppError(
        "Đăng nhập tạm thời bị giới hạn. Vui lòng thử lại sau 15 phút.",
        429,
        "LOGIN_RATE_LIMITED",
      );
    }
  }

  async recordFailure(phone: string, ipAddress: string) {
    const keys = this.keys(phone, ipAddress);
    await prisma.dashboardLoginFailure.create({ data: keys });
    await this.cleanupIfDue();
  }

  async clearAccountFailures(phone: string) {
    await prisma.dashboardLoginFailure.deleteMany({
      where: { targetHash: fingerprint("target", phone) },
    });
  }

  private async cleanupIfDue() {
    const now = Date.now();
    if (now - this.lastCleanupAt < 60 * 60 * 1000) return;
    this.lastCleanupAt = now;

    await prisma.dashboardLoginFailure.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
      },
    });
  }
}

export default new DashboardLoginSecurityService();

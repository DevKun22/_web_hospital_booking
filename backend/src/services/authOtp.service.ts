import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import type { OtpPurpose } from "../../generated/prisma/enums.js";
import { enqueueOtpDeliveryJob } from "../queues/otp.queue.js";
import OtpSenderService from "./otpSender.service.js";
import {
  isProductionLike,
  resolveOtpSecret,
} from "../config/environment.js";
import { shouldExposeDebugOtp } from "../config/otpChannels.js";
import AuthAttemptService from "./authAttempt.service.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { logger } from "../observability/logger.js";

type SendOtpOptions = {
  challengeId?: string;
  userId?: string;
};

type VerifyOtpOptions = {
  challengeId?: string;
  ipAddress?: string;
};

const OTP_SECRET = resolveOtpSecret();
const RESEND_COOLDOWN_SECONDS = 60;
const OTP_WINDOW_MINUTES = 15;
const MAX_OTP_SENDS_PER_WINDOW = 5;
const MAX_OTP_SENDS_PER_TARGET_WINDOW = 5;
const MAX_OTP_SENDS_PER_IP_WINDOW = 20;
const OTP_BLOCK_MINUTES = 30;
const OTP_EXPIRES_SECONDS = 5 * 60;
const VERIFY_WINDOW_MINUTES = 15;
const MAX_VERIFY_FAILS_PER_TARGET_WINDOW = 5;
const MAX_VERIFY_FAILS_PER_IP_WINDOW = 20;
const OTP_ENQUEUE_TIMEOUT_MS = getRuntimeConfig().otp.enqueueTimeoutMs;

type QueueAttemptResult =
  | { status: "QUEUED" }
  | { status: "UNAVAILABLE" }
  | { status: "FAILED"; error: unknown }
  | { status: "TIMEOUT" };

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const timeout = (milliseconds: number) =>
  new Promise<QueueAttemptResult>((resolve) => {
    setTimeout(() => resolve({ status: "TIMEOUT" }), milliseconds);
  });


// Hàng đợi (Redis) hỏng hoặc hết hạn mức thì vẫn phải gửi được OTP: gửi thẳng, không qua hàng đợi,
// và ghi lại trạng thái giao như worker vẫn làm. Không ném lỗi: người dùng chỉ cần biết OTP đã gửi hay chưa.
const deliverOtpDirectly = async (
  otpCodeId: string,
  job: { email: string; purpose: OtpPurpose; otp: string; expiresInSeconds: number },
): Promise<"SENT" | "FAILED"> => {
  try {
    await OtpSenderService.send(job);
    await prisma.otpCode.update({
      where: { id: otpCodeId },
      data: { deliveryStatus: "SENT", deliveryError: null, deliveredAt: new Date() },
    });
    return "SENT";
  } catch (error) {
    const message = getErrorMessage(error, "Không gửi được OTP");
    logger.error("[OTP_DIRECT] Cannot deliver OTP directly:", message);
    await prisma.otpCode
      .update({
        where: { id: otpCodeId },
        data: { deliveryStatus: "FAILED", deliveryError: message.slice(0, 1000) },
      })
      .catch(() => undefined);
    return "FAILED";
  }
};

const hashOtp = (otp: string) =>
  createHmac("sha256", OTP_SECRET).update(otp).digest("hex");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value: string) => {
  const normalized = value.trim();

  if (!normalized) throw new AppError("Thiếu email", 400);
  if (!emailRegex.test(normalized)) throw new AppError("Email không hợp lệ", 400);

  return normalized.toLowerCase();
};

const isSameOtp = (otp: string, otpHash: string) => {
  const expected = Buffer.from(hashOtp(otp), "hex");
  const actual = Buffer.from(otpHash, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

class AuthOtpService {
  private getBlockUntil() {
    return new Date(Date.now() + OTP_BLOCK_MINUTES * 60 * 1000);
  }

  private async assertNotBlocked(
    target: string,
    purpose: OtpPurpose,
    ipAddress?: string,
  ) {
    const now = new Date();
    const blocks = await prisma.otpSecurityBlock.findMany({
      where: {
        blockedUntil: {
          gt: now,
        },
        OR: [
          {
            targetType: "TARGET",
            target,
            OR: [{ purpose }, { purpose: null }],
          },
          ...(ipAddress
            ? [
                {
                  targetType: "IP",
                  target: ipAddress,
                  OR: [{ purpose }, { purpose: null }],
                },
              ]
            : []),
        ],
      },
      orderBy: {
        blockedUntil: "desc",
      },
      take: 1,
    });

    const block = blocks[0];
    if (!block) return;

    const retryAfterSeconds = Math.max(
      Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000),
      1,
    );

    throw new AppError(
      `Yêu cầu OTP đang bị tạm khóa. Vui lòng thử lại sau ${retryAfterSeconds} giây`,
      429,
    );
  }

  private async createBlock(input: {
    targetType: "TARGET" | "IP";
    target: string;
    purpose: OtpPurpose;
    reason: string;
  }) {
    await prisma.otpSecurityBlock.create({
      data: {
        targetType: input.targetType,
        target: input.target,
        purpose: input.purpose,
        reason: input.reason,
        blockedUntil: this.getBlockUntil(),
      },
    });
  }

  private async enforceSendLimits(
    target: string,
    purpose: OtpPurpose,
    ipAddress: string,
  ) {
    const windowStart = new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000);

    const recentCodes = await prisma.otpCode.findMany({
      where: {
        createdAt: { gte: windowStart },
        OR: [{ email: target, purpose }, { ipAddress }],
      },
      select: {
        email: true,
        purpose: true,
        ipAddress: true,
      },
    });
    const matchesTarget = (item: (typeof recentCodes)[number]) =>
      item.email === target && item.purpose === purpose;
    const targetCount = recentCodes.filter(matchesTarget).length;
    const pairCount = recentCodes.filter(
      (item) => matchesTarget(item) && item.ipAddress === ipAddress,
    ).length;
    const ipCount = recentCodes.filter(
      (item) => item.ipAddress === ipAddress,
    ).length;

    if (ipCount >= MAX_OTP_SENDS_PER_IP_WINDOW) {
      await this.createBlock({
        targetType: "IP",
        target: ipAddress,
        purpose,
        reason: "OTP_SEND_IP_LIMIT",
      });
      throw new AppError(
        "IP đã gửi OTP quá nhiều lần. Vui lòng thử lại sau.",
        429,
      );
    }

    if (
      targetCount >= MAX_OTP_SENDS_PER_TARGET_WINDOW ||
      pairCount >= MAX_OTP_SENDS_PER_WINDOW
    ) {
      await this.createBlock({
        targetType: "TARGET",
        target,
        purpose,
        reason: "OTP_SEND_TARGET_LIMIT",
      });
      throw new AppError(
        "Tài khoản nhận OTP đã gửi quá nhiều lần. Vui lòng thử lại sau.",
        429,
      );
    }
  }

  private async recordVerifyAttempt(input: {
    target: string;
    purpose: OtpPurpose;
    ipAddress?: string;
    success: boolean;
  }) {
    await AuthAttemptService.record({ kind: "OTP_VERIFY", ...input });
  }

  private async enforceVerifyFailLimits(
    target: string,
    purpose: OtpPurpose,
    ipAddress?: string,
  ) {
    const { byTarget: targetFails, byIp: ipFails } = await AuthAttemptService.countFailures({
      kind: "OTP_VERIFY",
      target,
      purpose,
      ipAddress,
      windowMs: VERIFY_WINDOW_MINUTES * 60 * 1000,
    });

    if (ipAddress && ipFails >= MAX_VERIFY_FAILS_PER_IP_WINDOW) {
      await this.createBlock({
        targetType: "IP",
        target: ipAddress,
        purpose,
        reason: "OTP_VERIFY_IP_LIMIT",
      });
      throw new AppError(
        "IP đã nhập sai OTP quá nhiều lần. Vui lòng thử lại sau.",
        429,
      );
    }

    if (targetFails >= MAX_VERIFY_FAILS_PER_TARGET_WINDOW) {
      await this.createBlock({
        targetType: "TARGET",
        target,
        purpose,
        reason: "OTP_VERIFY_TARGET_LIMIT",
      });
      throw new AppError(
        "Tài khoản nhận OTP đã nhập sai quá nhiều lần. Vui lòng thử lại sau.",
        429,
      );
    }
  }

  async sendOtp(
    targetInput: string,
    purpose: OtpPurpose,
    ipAddress: string,
    options: SendOtpOptions = {},
  ) {
    if (!purpose) {
      throw new AppError("Thiếu purpose khi gửi OTP", 400);
    }

    const target = normalizeEmail(targetInput);

    await this.assertNotBlocked(target, purpose, ipAddress);

    const lastOtp = await prisma.otpCode.findFirst({
      where: {
        email: target,
        purpose,
        ipAddress,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (lastOtp) {
      const seconds = Math.floor(
        (Date.now() - lastOtp.createdAt.getTime()) / 1000,
      );

      if (seconds < RESEND_COOLDOWN_SECONDS) {
        throw new AppError(
          `Vui lòng đợi ${RESEND_COOLDOWN_SECONDS - seconds} giây để gửi lại OTP`,
          429,
        );
      }
    }

    await this.enforceSendLimits(target, purpose, ipAddress);

    const otp = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_SECONDS * 1000);

    const otpRecord = await prisma.otpCode.create({
      data: {
        email: target,
        code: hashOtp(otp),
        purpose,
        ipAddress,
        challengeId: options.challengeId,
        userId: options.userId,
        expiresAt,
      },
    });

    const deliveryJob = {
      otpCodeId: otpRecord.id,
      email: target,
      purpose,
      otp,
      expiresInSeconds: OTP_EXPIRES_SECONDS,
    };
    let deliveryStatus: "PENDING" | "SENT" | "FAILED" = "PENDING";

    const queueAttemptPromise = enqueueOtpDeliveryJob(deliveryJob)
      .then<QueueAttemptResult>((queued) =>
        queued ? { status: "QUEUED" } : { status: "UNAVAILABLE" },
      )
      .catch<QueueAttemptResult>((error) => ({ status: "FAILED", error }));

    const queueAttempt = await Promise.race([
      queueAttemptPromise,
      timeout(OTP_ENQUEUE_TIMEOUT_MS),
    ]);

    if (queueAttempt.status === "TIMEOUT") {
      queueAttemptPromise
        .then(async (lateAttempt) => {
          if (
            lateAttempt.status !== "FAILED" &&
            lateAttempt.status !== "UNAVAILABLE"
          )
            return;

          const message =
            lateAttempt.status === "FAILED"
              ? getErrorMessage(
                  lateAttempt.error,
                  "Không đưa được OTP vào hàng đợi",
                )
              : "Chưa cấu hình hàng đợi gửi OTP";

          logger.error(
            "[OTP_QUEUE] Cannot enqueue OTP delivery job:",
            message,
          );

          await deliverOtpDirectly(otpRecord.id, deliveryJob);
        })
        .catch((error) => {
          logger.error(
            "[OTP_QUEUE] Cannot update timed out OTP delivery status:",
            error,
          );
        });
    }

    if (
      queueAttempt.status === "FAILED" ||
      queueAttempt.status === "UNAVAILABLE"
    ) {
      const message =
        queueAttempt.status === "FAILED"
          ? getErrorMessage(
              queueAttempt.error,
              "Không đưa được OTP vào hàng đợi",
            )
          : "Chưa cấu hình hàng đợi gửi OTP";

      logger.error("[OTP_QUEUE] Cannot enqueue OTP delivery job, sending directly:", message);
      deliveryStatus = await deliverOtpDirectly(otpRecord.id, deliveryJob);
    }

    if (!isProductionLike()) {
      logger.info("=================================");
      logger.info(`OTP DEV: ${otp}`);
      logger.info(`Target: ${target}`);
      logger.info(`Purpose: ${purpose}`);
      logger.info(`IP: ${ipAddress}`);
      logger.info(`Challenge: ${options.challengeId || "none"}`);
      logger.info(`Expires At: ${otpRecord.expiresAt.toISOString()}`);
      logger.info("=================================");
    }

    return {
      id: otpRecord.id,
      email: otpRecord.email,
      purpose: otpRecord.purpose,
      deliveryStatus,
      expiresAt: otpRecord.expiresAt,
      expiresIn: OTP_EXPIRES_SECONDS,
      debugOtp: shouldExposeDebugOtp() ? otp : undefined,
    };
  }

  async verifyOtp(
    targetInput: string,
    otp: string,
    purpose: OtpPurpose,
    options?: string | VerifyOtpOptions,
  ) {
    if (!targetInput) {
      throw new AppError("Thiếu thông tin nhận OTP", 400);
    }

    if (!otp) {
      throw new AppError("Thiếu mã OTP", 400);
    }

    if (!purpose) {
      throw new AppError("Thiếu purpose khi xác thực OTP", 400);
    }

    const verifyOptions =
      typeof options === "string" ? { challengeId: options } : options || {};
    const { challengeId, ipAddress } = verifyOptions;
    const target = normalizeEmail(targetInput);

    await this.assertNotBlocked(target, purpose, ipAddress);
    await this.enforceVerifyFailLimits(target, purpose, ipAddress);

    const candidates = await prisma.otpCode.findMany({
      where: {
        email: target,
        purpose,
        challengeId,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    const otpRecord = candidates.find((candidate) =>
      isSameOtp(otp, candidate.code),
    );

    if (!otpRecord) {
      await this.recordVerifyAttempt({
        target,
        purpose,
        ipAddress,
        success: false,
      });
      await this.enforceVerifyFailLimits(target, purpose, ipAddress);
      throw new AppError(
        "OTP không chính xác, đã hết hạn hoặc đã được sử dụng",
        401,
      );
    }

    const consumedAt = new Date();
    const consumed = await prisma.otpCode.updateMany({
      where: {
        id: otpRecord.id,
        email: target,
        purpose,
        challengeId,
        usedAt: null,
        expiresAt: {
          gt: consumedAt,
        },
      },
      data: {
        usedAt: consumedAt,
      },
    });

    if (consumed.count !== 1) {
      await this.recordVerifyAttempt({
        target,
        purpose,
        ipAddress,
        success: false,
      });
      throw new AppError(
        "OTP không chính xác, đã hết hạn hoặc đã được sử dụng",
        401,
      );
    }

    await this.recordVerifyAttempt({
      target,
      purpose,
      ipAddress,
      success: true,
    });

    return {
      verified: true,
      email: otpRecord.email,
      purpose: otpRecord.purpose,
      verifiedAt: new Date(),
    };
  }

  // Mã OTP hết hạn không còn giá trị sử dụng nhưng vẫn nằm lại bảng; giữ 24 giờ cho
  // điều tra rồi xóa theo lô để bảng không phình vô hạn.
  async cleanupExpired(options: { now?: Date; batchSize?: number } = {}) {
    const cutoff = new Date((options.now || new Date()).getTime() - 24 * 3_600_000);
    const stale = await prisma.otpCode.findMany({
      where: { expiresAt: { lt: cutoff } },
      select: { id: true },
      take: Math.max(options.batchSize || 1000, 1),
    });
    if (stale.length === 0) return { deleted: 0 };

    const result = await prisma.otpCode.deleteMany({
      where: { id: { in: stale.map((item) => item.id) } },
    });
    return { deleted: result.count };
  }
}

export default new AuthOtpService();

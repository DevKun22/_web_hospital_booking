import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import type { OtpChannel, OtpPurpose } from "../../generated/prisma/enums.js";
import { enqueueOtpDeliveryJob } from "../queues/otp.queue.js";
import {
  isProductionLike,
  resolveOtpSecret,
} from "../config/environment.js";

type SendOtpOptions = {
  channel?: OtpChannel;
  challengeId?: string;
  userId?: string;
};

type VerifyOtpOptions = {
  channel?: OtpChannel;
  challengeId?: string;
  ipAddress?: string;
};

const OTP_SECRET = resolveOtpSecret();
const RESEND_COOLDOWN_SECONDS = 60;
const OTP_WINDOW_MINUTES = 15;
const MAX_OTP_SENDS_PER_WINDOW = 5;
const MAX_OTP_SENDS_PER_PHONE_WINDOW = 5;
const MAX_OTP_SENDS_PER_IP_WINDOW = 20;
const OTP_BLOCK_MINUTES = 30;
const OTP_EXPIRES_SECONDS = 5 * 60;
const VERIFY_WINDOW_MINUTES = 15;
const MAX_VERIFY_FAILS_PER_PHONE_WINDOW = 5;
const MAX_VERIFY_FAILS_PER_IP_WINDOW = 20;
const OTP_ENQUEUE_TIMEOUT_MS = Number(
  process.env.OTP_ENQUEUE_TIMEOUT_MS || 1000,
);

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

const isOtpDebugEnabled = () =>
  !isProductionLike() &&
  ["true", "1", "yes", "on"].includes(
    (process.env.OTP_DEBUG_ENABLED || "").toLowerCase(),
  );

const hashOtp = (otp: string) =>
  createHmac("sha256", OTP_SECRET).update(otp).digest("hex");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeTarget = (target: string, channel: OtpChannel) => {
  const normalized = target.trim();

  if (!normalized) {
    throw new AppError(
      channel === "EMAIL" ? "Thiếu email" : "Thiếu số điện thoại",
      400,
    );
  }

  if (channel === "EMAIL" && !emailRegex.test(normalized)) {
    throw new AppError("Email không hợp lệ", 400);
  }

  return channel === "EMAIL" ? normalized.toLowerCase() : normalized;
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
    channel: OtpChannel,
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
            targetType: {
              in: channel === "SMS" ? ["TARGET", "PHONE"] : ["TARGET"],
            },
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
    channel: OtpChannel,
    purpose: OtpPurpose,
    ipAddress: string,
  ) {
    const windowStart = new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000);

    const [pairCount, phoneCount, ipCount] = await prisma.$transaction([
      prisma.otpCode.count({
        where: {
          target,
          channel,
          purpose,
          ipAddress,
          createdAt: {
            gte: windowStart,
          },
        },
      }),
      prisma.otpCode.count({
        where: {
          target,
          channel,
          purpose,
          createdAt: {
            gte: windowStart,
          },
        },
      }),
      prisma.otpCode.count({
        where: {
          ipAddress,
          createdAt: {
            gte: windowStart,
          },
        },
      }),
    ]);

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
      phoneCount >= MAX_OTP_SENDS_PER_PHONE_WINDOW ||
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
    channel: OtpChannel;
    purpose: OtpPurpose;
    ipAddress?: string;
    success: boolean;
  }) {
    await prisma.otpVerifyAttempt.create({
      data: {
        phone: input.channel === "SMS" ? input.target : "",
        email: input.channel === "EMAIL" ? input.target : null,
        target: input.target,
        channel: input.channel,
        purpose: input.purpose,
        ipAddress: input.ipAddress,
        success: input.success,
      },
    });
  }

  private async enforceVerifyFailLimits(
    target: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    ipAddress?: string,
  ) {
    const windowStart = new Date(
      Date.now() - VERIFY_WINDOW_MINUTES * 60 * 1000,
    );

    const [phoneFails, ipFails] = await prisma.$transaction([
      prisma.otpVerifyAttempt.count({
        where: {
          target,
          channel,
          purpose,
          success: false,
          createdAt: {
            gte: windowStart,
          },
        },
      }),
      ipAddress
        ? prisma.otpVerifyAttempt.count({
            where: {
              ipAddress,
              success: false,
              createdAt: {
                gte: windowStart,
              },
            },
          })
        : prisma.otpVerifyAttempt.count({ where: { id: "__none__" } }),
    ]);

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

    if (phoneFails >= MAX_VERIFY_FAILS_PER_PHONE_WINDOW) {
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

    const channel = options.channel || "SMS";
    const target = normalizeTarget(targetInput, channel);

    await this.assertNotBlocked(target, channel, purpose, ipAddress);

    const lastOtp = await prisma.otpCode.findFirst({
      where: {
        target,
        channel,
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

    await this.enforceSendLimits(target, channel, purpose, ipAddress);

    const otp = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_SECONDS * 1000);

    const otpRecord = await prisma.otpCode.create({
      data: {
        phone: channel === "SMS" ? target : "",
        email: channel === "EMAIL" ? target : null,
        target,
        channel,
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
      target,
      channel,
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

          console.error(
            "[OTP_QUEUE] Cannot enqueue OTP delivery job:",
            message,
          );

          await prisma.otpCode.update({
            where: { id: otpRecord.id },
            data: {
              deliveryStatus: "FAILED",
              deliveryError: message.slice(0, 1000),
            },
          });
        })
        .catch((error) => {
          console.error(
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

      console.error("[OTP_QUEUE] Cannot enqueue OTP delivery job:", message);

      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: {
          deliveryStatus: "FAILED",
          deliveryError: message.slice(0, 1000),
        },
      });

      deliveryStatus = "FAILED";
    }

    if (!isProductionLike()) {
      console.log("=================================");
      console.log(`OTP DEV: ${otp}`);
      console.log(`Target: ${target}`);
      console.log(`Channel: ${channel}`);
      console.log(`Purpose: ${purpose}`);
      console.log(`IP: ${ipAddress}`);
      console.log(`Challenge: ${options.challengeId || "none"}`);
      console.log(`Expires At: ${otpRecord.expiresAt.toISOString()}`);
      console.log("=================================");
    }

    return {
      id: otpRecord.id,
      phone: otpRecord.phone,
      email: otpRecord.email,
      target: otpRecord.target || otpRecord.phone,
      channel: otpRecord.channel,
      purpose: otpRecord.purpose,
      deliveryStatus,
      expiresAt: otpRecord.expiresAt,
      expiresIn: OTP_EXPIRES_SECONDS,
      debugOtp: isOtpDebugEnabled() ? otp : undefined,
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
    const channel = verifyOptions.channel || "SMS";
    const target = normalizeTarget(targetInput, channel);

    await this.assertNotBlocked(target, channel, purpose, ipAddress);
    await this.enforceVerifyFailLimits(target, channel, purpose, ipAddress);

    const candidates = await prisma.otpCode.findMany({
      where: {
        target,
        channel,
        purpose,
        challengeId,
        isUsed: false,
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
        channel,
        purpose,
        ipAddress,
        success: false,
      });
      await this.enforceVerifyFailLimits(target, channel, purpose, ipAddress);
      throw new AppError(
        "OTP không chính xác, đã hết hạn hoặc đã được sử dụng",
        401,
      );
    }

    const consumedAt = new Date();
    const consumed = await prisma.otpCode.updateMany({
      where: {
        id: otpRecord.id,
        target,
        channel,
        purpose,
        challengeId,
        isUsed: false,
        expiresAt: {
          gt: consumedAt,
        },
      },
      data: {
        isUsed: true,
        usedAt: consumedAt,
      },
    });

    if (consumed.count !== 1) {
      await this.recordVerifyAttempt({
        target,
        channel,
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
      channel,
      purpose,
      ipAddress,
      success: true,
    });

    return {
      verified: true,
      phone: otpRecord.phone,
      email: otpRecord.email,
      target: otpRecord.target || otpRecord.phone,
      channel: otpRecord.channel,
      purpose: otpRecord.purpose,
      verifiedAt: new Date(),
    };
  }
}

export default new AuthOtpService();

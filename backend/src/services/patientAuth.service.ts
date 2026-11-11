import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { getPatientAbsoluteExpiry } from "../config/patientSessionPolicy.js";
import { AppError } from "../utils/appError.js";
import { generatePatientAccessToken } from "../utils/jwt.js";
import AuthOtpService from "./authOtp.service.js";
import type { OtpChannel } from "../../generated/prisma/enums.js";
import {
  canDeliverSms,
  maskEmail,
  maskPhone,
} from "../config/otpChannels.js";
import AuthSessionService, {
  type SessionMeta,
} from "./authSession.service.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";

const MAX_CHALLENGE_ATTEMPTS = 5;
const CHALLENGE_EXPIRES_SECONDS = 5 * 60;
const ACCESS_TOKEN_EXPIRES_IN = getRuntimeConfig().patientSession
  .accessTokenExpiresIn as SignOptions["expiresIn"];

const toPatientUser = (user: {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  isPhoneVerified: boolean;
}) => ({
  id: user.id,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email,
  avatar: user.avatar,
  isPhoneVerified: user.isPhoneVerified,
});

const createAccessToken = (userId: string, sessionId: string) =>
  generatePatientAccessToken(
    { userId, sessionId },
    ACCESS_TOKEN_EXPIRES_IN,
  );

class PatientAuthService {
  // Đăng nhập bằng SĐT hoặc email. Kênh gửi OTP được chọn theo khả năng hệ
  // thống: SMS nếu có nhà cung cấp (hoặc số demo), không thì gửi về email đã
  // xác minh của tài khoản. Tài khoản chỉ được tạo mới khi gửi được OTP.
  async requestOtp(
    identifier: { phone?: string; email?: string },
    ipAddress: string,
  ) {
    const email = identifier.email?.trim().toLowerCase();
    const phone = identifier.phone?.trim();

    const existing = email
      ? await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, isActive: true, email: true, phone: true },
        })
      : await prisma.user.findUnique({
          where: { phone: phone! },
          select: { id: true, role: true, isActive: true, email: true, phone: true },
        });

    if (existing && existing.role !== "PATIENT") {
      throw new AppError(
        "Tài khoản này không dùng được cho cổng người khám",
        409,
        "PHONE_RESERVED",
      );
    }
    if (existing && !existing.isActive) {
      throw new AppError("Tài khoản đã bị khóa", 403, "ACCOUNT_DISABLED");
    }

    let channel: OtpChannel;
    let target: string;
    if (email) {
      if (!existing) {
        throw new AppError(
          "Email chưa gắn với tài khoản nào. Vui lòng đăng nhập bằng số điện thoại đã đặt lịch.",
          404,
          "PATIENT_EMAIL_NOT_FOUND",
        );
      }
      channel = "EMAIL";
      target = email;
    } else if (canDeliverSms(phone)) {
      channel = "SMS";
      target = phone!;
    } else if (existing?.email) {
      channel = "EMAIL";
      target = existing.email;
    } else {
      throw new AppError(
        "Hệ thống hiện chỉ gửi mã qua email nhưng số điện thoại này chưa có email. Hãy đặt lịch kèm email hoặc liên hệ bệnh viện.",
        400,
        "OTP_CHANNEL_UNAVAILABLE",
      );
    }

    const user =
      existing ??
      (await prisma.user.upsert({
        where: { phone: phone! },
        update: {},
        create: {
          fullName: "Người khám",
          phone: phone!,
          role: "PATIENT",
          isPhoneVerified: false,
        },
        select: { id: true, role: true, isActive: true, email: true, phone: true },
      }));

    if (user.role !== "PATIENT") {
      throw new AppError(
        "Tài khoản này không dùng được cho cổng người khám",
        409,
        "PHONE_RESERVED",
      );
    }

    const challenge = await prisma.dashboardLoginChallenge.create({
      data: {
        userId: user.id,
        purpose: "PATIENT_PORTAL_LOGIN",
        ipAddress,
        expiresAt: new Date(Date.now() + CHALLENGE_EXPIRES_SECONDS * 1000),
      },
      select: { id: true, expiresAt: true },
    });

    try {
      const otp = await AuthOtpService.sendOtp(
        target,
        "PATIENT_PORTAL_LOGIN",
        ipAddress,
        { channel, challengeId: challenge.id, userId: user.id },
      );

      return {
        challengeId: challenge.id,
        channel,
        maskedTarget: channel === "EMAIL" ? maskEmail(target) : maskPhone(target),
        deliveryStatus: otp.deliveryStatus,
        expiresAt: challenge.expiresAt,
        expiresIn: CHALLENGE_EXPIRES_SECONDS,
        debugOtp: otp.debugOtp,
      };
    } catch (error) {
      await prisma.dashboardLoginChallenge.delete({
        where: { id: challenge.id },
      });
      throw error;
    }
  }

  async verifyOtp(input: {
    challengeId: string;
    otp: string;
    meta?: SessionMeta;
  }) {
    const challenge = await prisma.dashboardLoginChallenge.findUnique({
      where: { id: input.challengeId },
      include: {
        user: true,
        otpCodes: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (
      !challenge ||
      challenge.purpose !== "PATIENT_PORTAL_LOGIN" ||
      challenge.isUsed ||
      challenge.expiresAt <= new Date()
    ) {
      throw new AppError("Challenge không hợp lệ hoặc đã hết hạn", 401);
    }

    if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
      throw new AppError("Bạn đã nhập sai OTP quá nhiều lần", 429);
    }

    if (challenge.user.role !== "PATIENT" || !challenge.user.isActive) {
      throw new AppError("Tài khoản người khám không hợp lệ", 403);
    }

    const otpChannel = challenge.otpCodes[0]?.channel || "SMS";
    try {
      await AuthOtpService.verifyOtp(
        challenge.otpCodes[0]?.target || challenge.user.phone || "",
        input.otp,
        "PATIENT_PORTAL_LOGIN",
        {
          channel: otpChannel,
          challengeId: challenge.id,
          ipAddress: challenge.ipAddress || undefined,
        },
      );
    } catch (error) {
      await prisma.dashboardLoginChallenge.updateMany({
        where: { id: challenge.id, isUsed: false },
        data: { attempts: { increment: 1 } },
      });
      throw error;
    }

    const claimed = await prisma.dashboardLoginChallenge.updateMany({
      where: { id: challenge.id, isUsed: false },
      data: { isUsed: true, usedAt: new Date() },
    });

    if (claimed.count !== 1) {
      throw new AppError("Challenge đã được sử dụng", 401);
    }

    const user = await prisma.user.update({
      where: { id: challenge.userId },
      data:
        otpChannel === "EMAIL" ? { isEmailVerified: true } : { isPhoneVerified: true },
    });
    const refreshExpiresAt = getPatientAbsoluteExpiry(input.meta?.platform);
    const authSession = await AuthSessionService.create({
      userId: user.id,
      kind: "PATIENT",
      expiresAt: refreshExpiresAt,
      meta: input.meta,
    });

    return {
      tokenType: "Bearer" as const,
      accessToken: createAccessToken(user.id, authSession.session.id),
      refreshToken: authSession.refreshToken,
      refreshExpiresAt,
      user: toPatientUser(user),
    };
  }

  async refresh(refreshToken: string, meta?: SessionMeta) {
    const rotated = await AuthSessionService.rotate({
      refreshToken,
      kind: "PATIENT",
      // AuthSessionService keeps the original absolute patient-session expiry.
      // This value is only used by non-patient session kinds.
      expiresAt: getPatientAbsoluteExpiry(meta?.platform),
      meta,
    });

    if (
      rotated.user.role !== "PATIENT" ||
      !rotated.user.isActive ||
      !rotated.user.isPhoneVerified
    ) {
      await AuthSessionService.revokeByRefreshToken(
        rotated.refreshToken,
        "PATIENT",
      );
      throw new AppError("Tài khoản người khám không hợp lệ", 403);
    }

    return {
      tokenType: "Bearer" as const,
      accessToken: createAccessToken(rotated.user.id, rotated.session.id),
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.session.expiresAt,
      user: toPatientUser(rotated.user),
    };
  }

  async logout(refreshToken?: string) {
    await AuthSessionService.revokeByRefreshToken(refreshToken, "PATIENT");
  }
}

export default new PatientAuthService();

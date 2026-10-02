import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { generatePatientAccessToken } from "../utils/jwt.js";
import AuthOtpService from "./authOtp.service.js";
import AuthSessionService, {
  type SessionMeta,
} from "./authSession.service.js";

const MAX_CHALLENGE_ATTEMPTS = 5;
const CHALLENGE_EXPIRES_SECONDS = 5 * 60;
const ACCESS_TOKEN_EXPIRES_IN = (process.env
  .PATIENT_ACCESS_TOKEN_EXPIRES_IN || "15m") as SignOptions["expiresIn"];

const readRefreshTokenDays = () => {
  const value = process.env.PATIENT_REFRESH_TOKEN_DAYS || "30";
  const match = value.match(/^(\d+)\s*d?$/i);
  return match ? Number(match[1]) : 30;
};

const getRefreshExpiresAt = () =>
  new Date(Date.now() + readRefreshTokenDays() * 24 * 60 * 60 * 1000);

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
  async requestOtp(phone: string, ipAddress: string) {
    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, role: true, isActive: true },
    });

    if (existing && existing.role !== "PATIENT") {
      throw new AppError(
        "Số điện thoại không thể dùng cho cổng bệnh nhân",
        409,
        "PHONE_RESERVED",
      );
    }

    if (existing && !existing.isActive) {
      throw new AppError("Tài khoản đã bị khóa", 403, "ACCOUNT_DISABLED");
    }

    const user = existing
      ? existing
      : await prisma.user.upsert({
          where: { phone },
          update: {},
          create: {
            fullName: "Bệnh nhân",
            phone,
            role: "PATIENT",
            isPhoneVerified: false,
          },
          select: { id: true, role: true, isActive: true },
        });

    if (user.role !== "PATIENT") {
      throw new AppError(
        "Số điện thoại không thể dùng cho cổng bệnh nhân",
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
        phone,
        "PATIENT_PORTAL_LOGIN",
        ipAddress,
        { channel: "SMS", challengeId: challenge.id, userId: user.id },
      );

      return {
        challengeId: challenge.id,
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
      throw new AppError("Tài khoản bệnh nhân không hợp lệ", 403);
    }

    try {
      await AuthOtpService.verifyOtp(
        challenge.otpCodes[0]?.target || challenge.user.phone || "",
        input.otp,
        "PATIENT_PORTAL_LOGIN",
        {
          channel: "SMS",
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
      data: { isPhoneVerified: true },
    });
    const refreshExpiresAt = getRefreshExpiresAt();
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
    const refreshExpiresAt = getRefreshExpiresAt();
    const rotated = await AuthSessionService.rotate({
      refreshToken,
      kind: "PATIENT",
      expiresAt: refreshExpiresAt,
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
      throw new AppError("Tài khoản bệnh nhân không hợp lệ", 403);
    }

    return {
      tokenType: "Bearer" as const,
      accessToken: createAccessToken(rotated.user.id, rotated.session.id),
      refreshToken: rotated.refreshToken,
      refreshExpiresAt,
      user: toPatientUser(rotated.user),
    };
  }

  async logout(refreshToken?: string) {
    await AuthSessionService.revokeByRefreshToken(refreshToken, "PATIENT");
  }
}

export default new PatientAuthService();

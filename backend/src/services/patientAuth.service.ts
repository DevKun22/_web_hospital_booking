import type { SignOptions } from "jsonwebtoken";
import { emailUnavailableError } from "./emailAvailability.js";
import { prisma } from "../config/prisma.js";
import { getPatientAbsoluteExpiry } from "../config/patientSessionPolicy.js";
import { AppError } from "../utils/appError.js";
import { generatePatientAccessToken } from "../utils/jwt.js";
import AuthOtpService from "./authOtp.service.js";
import { maskEmail } from "../config/otpChannels.js";
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
  email: string;
  avatar: string | null;
  isEmailVerified: boolean;
}) => ({
  id: user.id,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email,
  avatar: user.avatar,
  isEmailVerified: user.isEmailVerified,
});

const createAccessToken = (userId: string, sessionId: string) =>
  generatePatientAccessToken(
    { userId, sessionId },
    ACCESS_TOKEN_EXPIRES_IN,
  );

class PatientAuthService {
  // Đăng nhập bằng email: OTP gửi về chính email đó nên người nhận mã chứng minh sở hữu email. Email chưa có tài khoản thì tạo
  // tài khoản người khám mới (ngay khi gửi OTP; chỉ được dùng sau khi xác thực OTP thành công).
  async requestOtp(identifier: { email: string }, ipAddress: string) {
    const email = identifier.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isActive: true },
    });

    if (existing && existing.role !== "PATIENT") {
      throw emailUnavailableError(email, "STAFF_ACCOUNT");
    }
    if (existing && !existing.isActive) {
      throw emailUnavailableError(email, "PATIENT_DISABLED");
    }

    const user =
      existing ??
      (await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          fullName: "Người khám",
          email,
          role: "PATIENT",
        },
        select: { id: true, role: true, isActive: true },
      }));

    if (user.role !== "PATIENT") {
      throw emailUnavailableError(email, "STAFF_ACCOUNT");
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
        email,
        "PATIENT_PORTAL_LOGIN",
        ipAddress,
        { challengeId: challenge.id, userId: user.id },
      );

      return {
        challengeId: challenge.id,
        maskedTarget: maskEmail(email),
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
      challenge.usedAt ||
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

    try {
      await AuthOtpService.verifyOtp(
        challenge.otpCodes[0]?.email || challenge.user.email,
        input.otp,
        "PATIENT_PORTAL_LOGIN",
        {
          challengeId: challenge.id,
          ipAddress: challenge.ipAddress || undefined,
        },
      );
    } catch (error) {
      await prisma.dashboardLoginChallenge.updateMany({
        where: { id: challenge.id, usedAt: null },
        data: { attempts: { increment: 1 } },
      });
      throw error;
    }

    const claimed = await prisma.dashboardLoginChallenge.updateMany({
      where: { id: challenge.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (claimed.count !== 1) {
      throw new AppError("Challenge đã được sử dụng", 401);
    }

    const user = await prisma.user.update({
      where: { id: challenge.userId },
      data: { isEmailVerified: true },
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

  // Sau khi OTP đặt lịch được xác thực: người nhập đúng mã đã chứng minh sở hữu email của lịch, tương đương bước đăng nhập OTP,
  // nên cấp luôn phiên người khám để không bắt nhập OTP lần hai. Chỉ cấp khi lịch đã qua bước xác thực và email khớp tài khoản.
  async issueSessionForVerifiedAppointment(appointmentId: string, meta?: SessionMeta) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        status: true,
        patientEmail: true,
        patient: { select: { id: true, fullName: true, phone: true, email: true, avatar: true, role: true, isActive: true } },
      },
    });

    if (
      !appointment ||
      appointment.status === "PENDING_OTP" ||
      appointment.patient.role !== "PATIENT" ||
      !appointment.patient.isActive ||
      appointment.patient.email.toLowerCase() !== appointment.patientEmail.toLowerCase()
    ) {
      return null;
    }

    const user = await prisma.user.update({
      where: { id: appointment.patient.id },
      data: { isEmailVerified: true },
    });
    const refreshExpiresAt = getPatientAbsoluteExpiry(meta?.platform);
    const authSession = await AuthSessionService.create({
      userId: user.id,
      kind: "PATIENT",
      expiresAt: refreshExpiresAt,
      meta,
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
      !rotated.user.isEmailVerified
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

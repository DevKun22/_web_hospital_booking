import bcrypt from "bcrypt";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import AuthOtpService from "./authOtp.service.js";
import { generateToken } from "../utils/jwt.js";
import { AppError } from "../utils/appError.js";
import type { OtpPurpose, Role } from "../../generated/prisma/enums.js";
import AuthSessionService, {
  type SessionMeta,
} from "./authSession.service.js";

const DASHBOARD_ROLES: Role[] = ["ADMIN", "DOCTOR", "STAFF"];
const MAX_CHALLENGE_ATTEMPTS = 5;
const CHALLENGE_EXPIRES_SECONDS = 5 * 60;
const ACCESS_TOKEN_EXPIRES_IN = (process.env
  .DASHBOARD_ACCESS_TOKEN_EXPIRES_IN || "15m") as SignOptions["expiresIn"];
const readRefreshTokenDays = () => {
  const value = process.env.DASHBOARD_REFRESH_TOKEN_DAYS || "7";
  const match = value.match(/^(\d+)\s*d?$/i);

  return match ? Number(match[1]) : 7;
};

const REFRESH_TOKEN_DAYS = readRefreshTokenDays();

const dashboardPurposeByRole: Record<
  Extract<Role, "ADMIN" | "DOCTOR" | "STAFF">,
  OtpPurpose
> = {
  ADMIN: "ADMIN_LOGIN",
  DOCTOR: "DOCTOR_LOGIN",
  STAFF: "STAFF_LOGIN",
};

const redirectPathByRole: Record<
  Extract<Role, "ADMIN" | "DOCTOR" | "STAFF">,
  string
> = {
  ADMIN: "/admin/dashboard",
  DOCTOR: "/doctor/dashboard",
  STAFF: "/staff/dashboard",
};

const isDashboardRole = (
  role: Role,
): role is Extract<Role, "ADMIN" | "DOCTOR" | "STAFF"> =>
  DASHBOARD_ROLES.includes(role);

const toSafeDashboardUser = (user: {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: Role;
  avatar: string | null;
}) => ({
  id: user.id,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
});

const getRefreshExpiresAt = () =>
  new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

const createAccessToken = (
  user: { id: string; role: Role },
  sessionId: string,
) =>
  generateToken(
    {
      userId: user.id,
      role: user.role,
      sessionId,
      tokenType: "DASHBOARD_ACCESS",
    },
    ACCESS_TOKEN_EXPIRES_IN,
  );

class DashboardAuthService {
  async login(phone: string, password: string, ipAddress: string) {
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user || !user.password) {
      throw new AppError("Số điện thoại hoặc mật khẩu không chính xác", 401);
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      throw new AppError("Số điện thoại hoặc mật khẩu không chính xác", 401);
    }

    if (!user.isActive) {
      throw new AppError("Tài khoản đã bị khóa", 403);
    }

    if (!isDashboardRole(user.role)) {
      throw new AppError("Không có quyền truy cập dashboard", 403);
    }

    const purpose = dashboardPurposeByRole[user.role];
    const otpChannel = user.email ? "EMAIL" : "SMS";
    const otpTarget = user.email || phone;
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRES_SECONDS * 1000);

    const challenge = await prisma.dashboardLoginChallenge.create({
      data: {
        userId: user.id,
        purpose,
        ipAddress,
        expiresAt,
      },
    });

    let otp: Awaited<ReturnType<typeof AuthOtpService.sendOtp>>;

    try {
      otp = await AuthOtpService.sendOtp(otpTarget, purpose, ipAddress, {
        channel: otpChannel,
        challengeId: challenge.id,
        userId: user.id,
      });
    } catch (error) {
      await prisma.dashboardLoginChallenge.delete({
        where: {
          id: challenge.id,
        },
      });

      throw error;
    }

    return {
      challengeId: challenge.id,
      phone,
      email: user.email,
      otpTarget: otp.target,
      otpChannel: otp.channel,
      otpDeliveryStatus: otp.deliveryStatus,
      debugOtp: otp.debugOtp,
      expiresAt: challenge.expiresAt,
      expiresIn: CHALLENGE_EXPIRES_SECONDS,
      otpExpiresAt: otp.expiresAt,
      otpExpiresIn: otp.expiresIn,
    };
  }

  async verifyOtp(
    challengeId: string,
    otp: string,
    meta: SessionMeta = {},
  ) {
    const challenge = await prisma.dashboardLoginChallenge.findUnique({
      where: {
        id: challengeId,
      },
      include: {
        user: true,
        otpCodes: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!challenge) {
      throw new AppError("Challenge không hợp lệ", 401);
    }

    if (challenge.isUsed) {
      throw new AppError("Challenge đã được sử dụng", 401);
    }

    if (challenge.expiresAt <= new Date()) {
      throw new AppError("Challenge đã hết hạn", 401);
    }

    if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
      throw new AppError("Bạn đã nhập sai OTP quá nhiều lần", 429);
    }

    const { user } = challenge;
    const latestOtp = challenge.otpCodes[0];
    const otpTarget = latestOtp?.target || user.phone;
    const otpChannel = latestOtp?.channel || "SMS";

    if (!otpTarget) {
      throw new AppError("Tài khoản chưa có thông tin nhận OTP", 400);
    }

    if (!user.isActive) {
      throw new AppError("Tài khoản đã bị khóa", 403);
    }

    if (!isDashboardRole(user.role)) {
      throw new AppError("Không có quyền truy cập dashboard", 403);
    }

    try {
      await AuthOtpService.verifyOtp(otpTarget, otp, challenge.purpose, {
        channel: otpChannel,
        challengeId: challenge.id,
        ipAddress: challenge.ipAddress || undefined,
      });
    } catch (error) {
      await prisma.dashboardLoginChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      throw error;
    }

    await prisma.dashboardLoginChallenge.update({
      where: {
        id: challenge.id,
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    const refreshExpiresAt = getRefreshExpiresAt();
    const authSession = await AuthSessionService.create({
      userId: user.id,
      kind: "DASHBOARD",
      expiresAt: refreshExpiresAt,
      meta,
    });

    return {
      accessToken: createAccessToken(user, authSession.session.id),
      refreshToken: authSession.refreshToken,
      refreshExpiresAt,
      user: toSafeDashboardUser(user),
      redirectPath: redirectPathByRole[user.role],
    };
  }

  async refreshSession(
    refreshToken: string,
    meta: SessionMeta = {},
  ) {
    const refreshExpiresAt = getRefreshExpiresAt();
    const rotated = await AuthSessionService.rotate({
      refreshToken,
      kind: "DASHBOARD",
      expiresAt: refreshExpiresAt,
      meta,
    });
    const { user } = rotated;

    if (!user.isActive) {
      throw new AppError("Tài khoản đã bị khóa", 403);
    }

    if (!isDashboardRole(user.role)) {
      throw new AppError("Không có quyền truy cập dashboard", 403);
    }

    return {
      accessToken: createAccessToken(user, rotated.session.id),
      refreshToken: rotated.refreshToken,
      refreshExpiresAt,
      user: toSafeDashboardUser(user),
      redirectPath: redirectPathByRole[user.role],
    };
  }

  async revokeSession(refreshToken?: string) {
    if (!refreshToken) return;

    await AuthSessionService.revokeByRefreshToken(refreshToken, "DASHBOARD");
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError("Tài khoản không tồn tại", 401);
    }

    if (!user.isActive) {
      throw new AppError("Tài khoản đã bị khóa", 403);
    }

    if (!isDashboardRole(user.role)) {
      throw new AppError("Không có quyền truy cập dashboard", 403);
    }

    return toSafeDashboardUser(user);
  }
}

export default new DashboardAuthService();

import { isProductionLike } from "../config/environment.js";
import { Request, Response, NextFunction } from "express";
import DashboardAuthService from "../services/dashboardAuth.service.js";
import { getClientIp } from "../utils/clientIp.js";

type CookieSameSite = "strict" | "lax" | "none";

const readSameSite = (): CookieSameSite => {
  const value = (process.env.DASHBOARD_COOKIE_SAME_SITE || "").toLowerCase();

  if (value === "strict" || value === "lax" || value === "none") {
    return value as CookieSameSite;
  }

  return isProductionLike() ? "none" : "lax";
};

const dashboardCookieOptions = {
  httpOnly: true,
  secure: isProductionLike(),
  sameSite: readSameSite(),
  path: "/",
};

const readRefreshCookieDays = () => {
  const value = process.env.DASHBOARD_REFRESH_TOKEN_DAYS || "7";
  const match = value.match(/^(\d+)\s*d?$/i);

  return match ? Number(match[1]) : 7;
};

const ACCESS_COOKIE_MAX_AGE =
  Number(process.env.DASHBOARD_ACCESS_COOKIE_MAX_AGE_SECONDS || 15 * 60) * 1000;
const REFRESH_COOKIE_MAX_AGE = readRefreshCookieDays() * 24 * 60 * 60 * 1000;

const getRequestMeta = (req: Request) => ({
  ipAddress: getClientIp(req),
  userAgent: req.headers["user-agent"],
});

const setDashboardAuthCookies = (
  res: Response,
  result: {
    accessToken: string;
    refreshToken: string;
  },
) => {
  res.cookie("dashboard_token", result.accessToken, {
    ...dashboardCookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  res.cookie("dashboard_refresh_token", result.refreshToken, {
    ...dashboardCookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearDashboardAuthCookies = (res: Response) => {
  res.clearCookie("dashboard_token", dashboardCookieOptions);
  res.clearCookie("dashboard_refresh_token", dashboardCookieOptions);
};

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { phone, password } = req.body;

    const result = await DashboardAuthService.login(
      phone,
      password,
      getRequestMeta(req).ipAddress,
    );

    return res.json({
      success: true,
      message: "OTP đã được gửi",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { challengeId, otp } = req.body;

    const result = await DashboardAuthService.verifyOtp(
      challengeId,
      otp,
      getRequestMeta(req),
    );

    setDashboardAuthCookies(res, result);

    return res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        user: result.user,
        redirectPath: result.redirectPath,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refreshToken = req.cookies.dashboard_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn",
      });
    }

    const result = await DashboardAuthService.refreshSession(
      refreshToken,
      getRequestMeta(req),
    );

    setDashboardAuthCookies(res, result);

    return res.json({
      success: true,
      message: "Đã làm mới phiên đăng nhập",
      data: {
        user: result.user,
        redirectPath: result.redirectPath,
      },
    });
  } catch (error) {
    clearDashboardAuthCookies(res);
    next(error);
  }
};

export const meHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const user = await DashboardAuthService.getCurrentUser(userId);

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const logoutHandler = async (req: Request, res: Response) => {
  await DashboardAuthService.revokeSession(req.cookies.dashboard_refresh_token);
  clearDashboardAuthCookies(res);

  return res.json({
    success: true,
    message: "Đăng xuất thành công",
  });
};

export const changePasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }
    await DashboardAuthService.changePassword({
      userId: req.user.userId,
      sessionId: req.user.sessionId,
      role: req.user.role,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      ipAddress: getClientIp(req),
    });
    return res.json({ success: true, message: "Đã đổi mật khẩu" });
  } catch (error) {
    next(error);
  }
};

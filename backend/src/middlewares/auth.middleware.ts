import { NextFunction, Request, Response } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { verifyToken } from "../utils/jwt.js";
import {
  cacheDashboardAuthSnapshot,
  getCachedDashboardAuthSnapshot,
} from "../services/dashboardAuthCache.service.js";
import AuthSessionService from "../services/authSession.service.js";

const DASHBOARD_ROLES: Role[] = ["ADMIN", "DOCTOR", "STAFF"];

export const authDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies.dashboard_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const payload = verifyToken(token);

    if (payload.tokenType && payload.tokenType !== "DASHBOARD_ACCESS") {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    if (payload.sessionId) {
      await AuthSessionService.assertActiveSession({
        sessionId: payload.sessionId,
        userId: payload.userId,
        kind: "DASHBOARD",
      });
    }

    let user = getCachedDashboardAuthSnapshot(payload.userId);

    if (!user) {
      const userLookupStartedAt = performance.now();
      user = await prisma.user.findUnique({
        where: {
          id: payload.userId,
        },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });
      const userLookupMs = performance.now() - userLookupStartedAt;

      if (userLookupMs >= 100) {
        console.warn(
          `[SLOW_AUTH_LOOKUP] user=${payload.userId} ${userLookupMs.toFixed(1)}ms`,
        );
      }

      if (user) {
        cacheDashboardAuthSnapshot(user);
      }
    }

    if (!user || !user.isActive || !DASHBOARD_ROLES.includes(user.role)) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ",
      });
    }

    req.user = {
      ...payload,
      userId: user.id,
      role: user.role,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
    });
  }
};

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole as Role)) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập",
      });
    }

    next();
  };

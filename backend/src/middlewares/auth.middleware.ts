import { NextFunction, Request, Response } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { verifyDashboardAccessToken } from "../utils/jwt.js";
import {
  cacheDashboardAuthSnapshot,
  getCachedDashboardAuthSnapshot,
} from "../services/dashboardAuthCache.service.js";
import AuthSessionService from "../services/authSession.service.js";

import { STAFF_ROLES, type PermissionCode } from "../config/permissions.js";
import { roleHasAnyPermission } from "../services/rbac.service.js";

const DASHBOARD_ROLES: Role[] = [...STAFF_ROLES];

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

    const payload = verifyDashboardAccessToken(token);

    await AuthSessionService.assertActiveSession({
      sessionId: payload.sessionId!,
      userId: payload.userId,
      kind: "DASHBOARD",
    });

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

// Cho qua khi vai trò của người dùng được cấp BẤT KỲ mã quyền nào trong danh sách.
// Quyền do ma trận `rbac.matrix` quyết định; ràng buộc cứng nằm ở config/permissions.ts.
export const requirePermission =
  (...codes: PermissionCode[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await roleHasAnyPermission(req.user?.role, codes))) {
        return res.status(403).json({
          success: false,
          message: "Không có quyền truy cập",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };

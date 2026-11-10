import { NextFunction, Request, Response } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { verifyDashboardAccessToken } from "../utils/jwt.js";
import AuthSessionService from "../services/authSession.service.js";

import { STAFF_ROLES, type PermissionCode } from "../config/permissions.js";
import { roleHasAnyPermission } from "../services/rbac.service.js";

const DASHBOARD_ROLES: Role[] = [...STAFF_ROLES];
const SLOW_AUTH_LOOKUP_MS = 100;
const SLOW_AUTH_WARN_INTERVAL_MS = 60_000;
let lastSlowAuthWarnAt = 0;

const warnSlowAuthLookup = (userId: string, durationMs: number) => {
  if (durationMs < SLOW_AUTH_LOOKUP_MS) return;

  const now = Date.now();
  if (now - lastSlowAuthWarnAt < SLOW_AUTH_WARN_INTERVAL_MS) return;
  lastSlowAuthWarnAt = now;
  console.warn(`[SLOW_AUTH_LOOKUP] user=${userId} ${durationMs.toFixed(1)}ms`);
};

const createAuthDashboard =
  (options: { allowPasswordChange: boolean }) =>
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.dashboard_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const payload = verifyDashboardAccessToken(token);

    const authLookupStartedAt = performance.now();
    const user = await AuthSessionService.getActiveDashboardIdentity({
      sessionId: payload.sessionId!,
      userId: payload.userId,
    });
    const authLookupMs = performance.now() - authLookupStartedAt;
    warnSlowAuthLookup(payload.userId, authLookupMs);

    if (!user.isActive || !DASHBOARD_ROLES.includes(user.role)) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ",
      });
    }

    // Tài khoản do quản trị tạo hoặc đặt lại mật khẩu chỉ được đổi mật khẩu (và xem hồ sơ
    // của mình) cho tới khi tự đặt mật khẩu mới.
    if (user.mustChangePassword && !options.allowPasswordChange) {
      return res.status(403).json({
        success: false,
        message: "Bạn cần đổi mật khẩu trước khi tiếp tục",
        code: "PASSWORD_CHANGE_REQUIRED",
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

export const authDashboard = createAuthDashboard({ allowPasswordChange: false });
// Dùng cho /auth/me và /auth/change-password: tài khoản bị buộc đổi mật khẩu vẫn gọi được.
export const authDashboardAllowPasswordChange = createAuthDashboard({
  allowPasswordChange: true,
});

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

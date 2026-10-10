import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/appError.js";
import {
  type LookupGrantScope,
  verifyLookupGrant,
} from "../utils/lookupGrant.js";

export const requireLookupGrant = (...requiredScopes: LookupGrantScope[]) =>
  function lookupGrantMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      next(
        new AppError(
          "Cần xác thực OTP để truy cập thông tin này",
          401,
          "LOOKUP_GRANT_REQUIRED",
        ),
      );
      return;
    }

    try {
      const grant = verifyLookupGrant(token);
      const hasRequiredScopes = requiredScopes.every((scope) =>
        grant.scopes.includes(scope),
      );

      if (!hasRequiredScopes) {
        next(
          new AppError(
            "Phiên xác thực không có quyền truy cập",
            403,
            "LOOKUP_GRANT_SCOPE_DENIED",
          ),
        );
        return;
      }

      req.lookupGrant = grant;
      next();
    } catch {
      next(
        new AppError(
          "Phiên xác thực đã hết hạn hoặc không hợp lệ",
          401,
          "LOOKUP_GRANT_INVALID",
        ),
      );
    }
  };

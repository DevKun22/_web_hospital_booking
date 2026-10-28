import type { NextFunction, Request, Response } from "express";

export const DASHBOARD_REQUEST_HEADER = "x-hospital-dashboard-request";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Dashboard authentication uses HttpOnly cookies. Requiring a custom header on
// unsafe cookie-authenticated requests prevents cross-site HTML forms from
// changing state, while CORS prevents an untrusted origin from adding it.
export const protectDashboardCookieRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const usesDashboardCookie = Boolean(
    req.cookies?.dashboard_token || req.cookies?.dashboard_refresh_token,
  );
  if (!usesDashboardCookie) {
    next();
    return;
  }

  if (req.get(DASHBOARD_REQUEST_HEADER) !== "1") {
    res.status(403).json({
      success: false,
      code: "CSRF_VALIDATION_FAILED",
      message: "Yêu cầu dashboard không hợp lệ",
      requestId: req.requestId,
      errors: [],
    });
    return;
  }

  next();
};

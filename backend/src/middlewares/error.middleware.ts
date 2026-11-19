import { isProductionLike } from "../config/environment.js";
import { Request, Response, NextFunction } from "express";
import { getSafeRequestPath } from "../observability/requestPerformance.js";
import { logger } from "../observability/logger.js";

export const errorMiddleware = (
  err: Error & { statusCode?: number; code?: string; retryAfterSeconds?: number },
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = err.statusCode || 500;
  const code =
    (err.statusCode ? err.code : undefined) ||
    (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");
  const message =
    statusCode >= 500 && isProductionLike()
      ? "Internal server error"
      : err.message || "Internal server error";

  const logMessage = `[HTTP_ERROR] requestId=${req.requestId} method=${req.method} path=${getSafeRequestPath(req.originalUrl)} status=${statusCode} code=${code} message=${err.message}`;
  if (statusCode >= 500) logger.error(logMessage, err.stack || "");
  else logger.warn(logMessage);

  // Trình duyệt chéo nguồn không đọc được header Retry-After (không được khai báo ở CORS), nên đưa cả vào thân phản hồi để giao diện
  // đếm ngược thay vì bảo người dùng "thử lại sau ít phút".
  const retryAfter = err.retryAfterSeconds ?? Number(res.getHeader("Retry-After"));

  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
    requestId: req.requestId,
    errors: [],
  });
};

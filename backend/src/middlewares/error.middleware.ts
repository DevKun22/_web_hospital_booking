import { Request, Response, NextFunction } from "express";

export const errorMiddleware = (
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const statusCode = err.statusCode || 500;
  const code =
    (err.statusCode ? err.code : undefined) ||
    (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");
  const message =
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  const logMessage = `[HTTP_ERROR] requestId=${req.requestId} method=${req.method} path=${req.originalUrl} status=${statusCode} code=${code} message=${err.message}`;
  if (statusCode >= 500) console.error(logMessage, err.stack || "");
  else console.warn(logMessage);

  res.status(statusCode).json({
    success: false,
    code,
    message,
    requestId: req.requestId,
    errors: [],
  });
};

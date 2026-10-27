import type { NextFunction, Request, Response } from "express";
import AuthSessionService from "../services/authSession.service.js";
import { AppError } from "../utils/appError.js";
import { verifyPatientAccessToken } from "../utils/jwt.js";

const authenticatePatient = async (req: Request) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(" ") || [];

  if (scheme?.toLowerCase() !== "bearer" || !token) return false;

  const payload = verifyPatientAccessToken(token);
  await AuthSessionService.assertActivePatientSession({
    sessionId: payload.sessionId!,
    userId: payload.userId,
  });

  req.patient = {
    ...payload,
    userId: payload.userId,
    role: "PATIENT",
    sessionId: payload.sessionId!,
  };
  return true;
};

const rejectInvalidPatientToken = (req: Request, res: Response) =>
  res.status(401).json({
    success: false,
    code: "INVALID_ACCESS_TOKEN",
    message: "Access token không hợp lệ hoặc đã hết hạn",
    requestId: req.requestId,
    errors: [],
  });

export const authPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!(await authenticatePatient(req))) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Vui lòng đăng nhập",
        requestId: req.requestId,
        errors: [],
      });
    }

    next();
  } catch (error) {
    const isAuthenticationError =
      error instanceof AppError ||
      ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(
        (error as { name?: string }).name || "",
      );

    if (!isAuthenticationError) {
      next(error);
      return;
    }

    return rejectInvalidPatientToken(req, res);
  }
};

// Public booking remains available without a session. When a bearer token is
// present it must be valid; silently degrading an invalid token to a guest
// would make dependent ownership checks ambiguous.
export const optionalAuthPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      next();
      return;
    }
    if (!(await authenticatePatient(req))) {
      return rejectInvalidPatientToken(req, res);
    }
    next();
  } catch (error) {
    const isAuthenticationError =
      error instanceof AppError ||
      ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(
        (error as { name?: string }).name || "",
      );
    if (!isAuthenticationError) {
      next(error);
      return;
    }
    return rejectInvalidPatientToken(req, res);
  }
};

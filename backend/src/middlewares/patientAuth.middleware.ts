import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import AuthSessionService from "../services/authSession.service.js";
import { AppError } from "../utils/appError.js";
import { verifyPatientAccessToken } from "../utils/jwt.js";

export const authPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authorization = req.headers.authorization;
    const [scheme, token] = authorization?.split(" ") || [];

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Vui lòng đăng nhập",
        requestId: req.requestId,
        errors: [],
      });
    }

    const payload = verifyPatientAccessToken(token);
    const [user] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          isPhoneVerified: true,
        },
      }),
      AuthSessionService.assertActiveSession({
        sessionId: payload.sessionId!,
        userId: payload.userId,
        kind: "PATIENT",
      }),
    ]);

    if (
      !user ||
      user.role !== "PATIENT" ||
      !user.isActive ||
      !user.isPhoneVerified
    ) {
      return res.status(401).json({
        success: false,
        code: "INVALID_PATIENT_SESSION",
        message: "Phiên đăng nhập không hợp lệ",
        requestId: req.requestId,
        errors: [],
      });
    }

    req.patient = {
      ...payload,
      userId: user.id,
      role: "PATIENT",
      sessionId: payload.sessionId!,
    };
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

    return res.status(401).json({
      success: false,
      code: "INVALID_ACCESS_TOKEN",
      message: "Access token không hợp lệ hoặc đã hết hạn",
      requestId: req.requestId,
      errors: [],
    });
  }
};

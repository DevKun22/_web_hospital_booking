import type { NextFunction, Request, Response } from "express";
import AuthSessionService from "../services/authSession.service.js";
import PatientAuthService from "../services/patientAuth.service.js";
import { AppError } from "../utils/appError.js";

const getIpAddress = (req: Request) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";

const getSessionMeta = (req: Request) => ({
  ipAddress: getIpAddress(req),
  userAgent: req.headers["user-agent"],
  deviceId: req.body.deviceId,
  deviceName: req.body.deviceName,
  platform: req.body.platform,
  appVersion: req.body.appVersion,
});

const requirePatient = (req: Request) => {
  if (!req.patient) throw new AppError("Vui lòng đăng nhập", 401);
  return req.patient;
};

export const requestPatientOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await PatientAuthService.requestOtp(
      req.body.phone,
      getIpAddress(req),
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const verifyPatientOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await PatientAuthService.verifyOtp({
      challengeId: req.body.challengeId,
      otp: req.body.otp,
      meta: getSessionMeta(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const refreshPatientSessionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await PatientAuthService.refresh(
      req.body.refreshToken,
      getSessionMeta(req),
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const logoutPatientHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await PatientAuthService.logout(req.body.refreshToken);
    return res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
};

export const listPatientSessionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const patient = requirePatient(req);
    const data = await AuthSessionService.list(
      patient.userId,
      "PATIENT",
      patient.sessionId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const revokePatientSessionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const patient = requirePatient(req);
    const sessionId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    if (!sessionId) throw new AppError("Thiếu session id", 400);

    await AuthSessionService.revokeSession({
      sessionId,
      userId: patient.userId,
      kind: "PATIENT",
      exceptSessionId: patient.sessionId,
    });
    return res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
};

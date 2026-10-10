import type { Request, Response, NextFunction } from "express";
import type { AppointmentStatus, Role } from "../../generated/prisma/enums.js";
import AppointmentService from "../services/appointment.service.js";
import { AppError } from "../utils/appError.js";

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const getParam = (value: string | string[] | undefined, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

const getIpAddress = (req: Request) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";

const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role) {
    throw new AppError("Chưa đăng nhập", 401);
  }

  return {
    userId: req.user.userId,
    role: req.user.role as Role,
  };
};

export const createAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.create(req.body, getIpAddress(req));

    return res.status(201).json({
      success: true,
      message: "OTP đã được gửi để xác nhận lịch hẹn",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resendAppointmentOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.resendOtp(
      getParam(req.params.id),
      getIpAddress(req),
    );

    return res.json({
      success: true,
      message: "OTP đã được gửi lại",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyAppointmentOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.verifyOtp(
      getParam(req.params.id),
      req.body.otp,
      getIpAddress(req),
    );

    return res.json({
      success: true,
      message: "Xác thực đặt lịch thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.getPublicById(
      getParam(req.params.id),
      typeof req.query.phone === "string" ? req.query.phone : "",
    );

    return res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const lookupPublicAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.lookupPublic({
      bookingCode:
        typeof req.query.bookingCode === "string"
          ? req.query.bookingCode
          : undefined,
      phone: typeof req.query.phone === "string" ? req.query.phone : undefined,
    });

    return res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicAppointmentResultHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.getPublicResult({
      bookingCode:
        typeof req.query.bookingCode === "string"
          ? req.query.bookingCode
          : undefined,
      patientId: req.lookupGrant?.sub || "",
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const requestPublicAppointmentLookupOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.requestLookupOtp({
      phone: req.body.phone,
      bookingCode: req.body.bookingCode,
      ipAddress: getIpAddress(req),
    });

    return res.json({
      success: true,
      message: "OTP tra cứu lịch hẹn đã được gửi",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPublicAppointmentLookupOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.verifyLookupOtp({
      phone: req.body.phone,
      bookingCode: req.body.bookingCode,
      otp: req.body.otp,
      ipAddress: getIpAddress(req),
    });

    return res.json({
      success: true,
      message: "Xác thực OTP tra cứu lịch hẹn thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const requestPublicAppointmentCancelOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.requestPublicCancelOtp({
      bookingCode: req.body.bookingCode,
      phone: req.body.phone,
      reason: req.body.reason,
      ipAddress: getIpAddress(req),
    });

    return res.json({
      success: true,
      message: "OTP hủy lịch hẹn đã được gửi",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPublicAppointmentCancelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.verifyPublicCancel({
      bookingCode: req.body.bookingCode,
      phone: req.body.phone,
      reason: req.body.reason,
      otp: req.body.otp,
      ipAddress: getIpAddress(req),
    });

    return res.json({
      success: true,
      message: "Hủy lịch hẹn thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const listDashboardAppointmentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.dashboardList(
      {
        status:
          typeof req.query.status === "string"
            ? (req.query.status as AppointmentStatus)
            : undefined,
        doctorId:
          typeof req.query.doctorId === "string"
            ? req.query.doctorId
            : undefined,
        date: typeof req.query.date === "string" ? req.query.date : undefined,
        phone:
          typeof req.query.phone === "string" ? req.query.phone : undefined,
        bookingCode:
          typeof req.query.bookingCode === "string"
            ? req.query.bookingCode
            : undefined,
        page: parseNumberQuery(req.query.page),
        limit: parseNumberQuery(req.query.limit),
      },
      getActor(req),
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.dashboardGetById(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

export const confirmDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.confirm(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Xác nhận lịch hẹn thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboardAppointmentStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.updateStatus(
      getParam(req.params.id),
      req.body.status,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Cập nhật trạng thái lịch hẹn thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboardAppointmentPatientInfoHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.updatePatientInfo(
      getParam(req.params.id),
      req.body,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Cập nhật thông tin tiếp nhận thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.cancel(
      getParam(req.params.id),
      req.body.reason,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Hủy lịch hẹn thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const cleanupExpiredPendingOtpAppointmentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const expireMinutes = parseNumberQuery(req.query.expireMinutes);
    const result = await AppointmentService.cleanupExpiredPendingOtp(
      getActor(req),
      expireMinutes,
    );

    return res.json({
      success: true,
      message: "Dọn lịch hẹn quá hạn OTP thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const checkInDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.checkIn(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Check-in lịch hẹn thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const startDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.start(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Bắt đầu khám thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const completeDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.complete(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Hoàn thành lịch hẹn thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const noShowDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.markNoShow(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Đánh dấu no-show thành công",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

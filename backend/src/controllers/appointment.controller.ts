import type { Request, Response, NextFunction } from "express";
import type { AppointmentStatus, Role } from "../../generated/prisma/enums.js";
import AppointmentService from "../services/appointment.service.js";
import {
  getRequiredPathParam as getParam,
  parseNumberQuery,
} from "../shared/http/requestParsers.js";
import { AppError } from "../utils/appError.js";
import { getClientIp } from "../utils/clientIp.js";

const getIpAddress = getClientIp;

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
    const result = await AppointmentService.create(
      req.body,
      getIpAddress(req),
      req.patient ? { userId: req.patient.userId } : undefined,
    );

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

export const abandonPendingAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AppointmentService.abandonPendingOtp(
      getParam(req.params.id),
      req.body.holdReleaseToken,
    );
    return res.json({
      success: true,
      message: "Đã hủy giữ lịch và giải phóng khung giờ",
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
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        billingState:
          req.query.billingState === "PENDING_INVOICE" ||
          req.query.billingState === "HAS_INVOICE"
            ? req.query.billingState
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

export const rescheduleDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appointment = await AppointmentService.reschedule(
      getParam(req.params.id),
      req.body,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Đổi lịch hẹn thành công",
      data: appointment,
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

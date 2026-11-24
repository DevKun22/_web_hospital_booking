import type { Request, Response } from "express";
import { AppointmentStatus, Role } from "../../generated/prisma/enums.js";
import AppointmentService from "../services/appointment.service.js";
import { presentDashboardAppointment } from "../services/appointment/appointmentDashboard.service.js";
import PatientAuthService from "../services/patientAuth.service.js";
import { getRequiredPathParam as getParam, parseEnumQuery, parseNumberQuery, parseStringQuery } from "../shared/http/requestParsers.js";
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
) => {
  const result = await AppointmentService.create(
    req.body,
    getIpAddress(req),
    req.patient ? { userId: req.patient.userId } : undefined,
  );

  return res.status(201).json({
    success: true,
    message: result.otpRequired
      ? "OTP đã được gửi để xác nhận lịch hẹn"
      : "Đã tiếp nhận lịch hẹn",
    data: result,
  });
};

export const resendAppointmentOtpHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await AppointmentService.resendOtp(
    getParam(req.params.id),
    getIpAddress(req),
  );

  return res.json({
    success: true,
    message: "OTP đã được gửi lại",
    data: result,
  });
};

export const abandonPendingAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await AppointmentService.abandonPendingOtp(
    getParam(req.params.id),
    req.body.holdReleaseToken,
  );
  return res.json({
    success: true,
    message: "Đã hủy giữ lịch và giải phóng khung giờ",
    data: result,
  });
};

export const verifyAppointmentOtpHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.verifyOtp(
    getParam(req.params.id),
    req.body.otp,
    getIpAddress(req),
  );

  // Chỉ cấp phiên khi client yêu cầu; lỗi cấp phiên không làm hỏng việc xác nhận lịch đã thành công.
  let session = null;
  if (req.body.issueSession === true) {
    session = await PatientAuthService.issueSessionForVerifiedAppointment(
      appointment.id,
      {
        ipAddress: getIpAddress(req),
        userAgent: req.headers["user-agent"],
        deviceId: req.body.deviceId,
        deviceName: req.body.deviceName,
        platform: req.body.platform,
        appVersion: req.body.appVersion,
      },
    ).catch(() => null);
  }

  return res.json({
    success: true,
    message: "Xác thực đặt lịch thành công",
    data: session ? { ...appointment, session } : appointment,
  });
};

export const listDashboardAppointmentsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await AppointmentService.dashboardList(
    {
      status:
        parseEnumQuery(req.query.status, AppointmentStatus, "status"),
      doctorId:
        parseStringQuery(req.query.doctorId),
      date: parseStringQuery(req.query.date),
      phone:
        parseStringQuery(req.query.phone),
      bookingCode:
        parseStringQuery(req.query.bookingCode),
      q: parseStringQuery(req.query.q),
      billingState:
        req.query.billingState === "PENDING_INVOICE" ||
        req.query.billingState === "HAS_INVOICE"
          ? req.query.billingState
          : undefined,
      view: req.query.view === "ACTIVE" ? "ACTIVE" : undefined,
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    },
    getActor(req),
  );

  return res.json({ success: true, data: result });
};

export const getDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.dashboardGetById(
    getParam(req.params.id),
    getActor(req),
  );

  return res.json({ success: true, data: appointment });
};

export const confirmDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.confirm(
    getParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Xác nhận lịch hẹn thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const updateDashboardAppointmentPatientInfoHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.updatePatientInfo(
    getParam(req.params.id),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật thông tin tiếp nhận thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const cancelDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.cancel(
    getParam(req.params.id),
    req.body.reason,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Hủy lịch hẹn thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const rescheduleDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.reschedule(
    getParam(req.params.id),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Đổi lịch hẹn thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const checkInDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.checkIn(
    getParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Check-in lịch hẹn thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const startDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.start(
    getParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Bắt đầu khám thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const completeDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.complete(
    getParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Hoàn thành lịch hẹn thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

export const noShowDashboardAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const appointment = await AppointmentService.markNoShow(
    getParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Đánh dấu no-show thành công",
    data: await presentDashboardAppointment(getActor(req).role, appointment),
  });
};

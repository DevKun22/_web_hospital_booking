import type { NextFunction, Request, Response } from "express";
import ReviewService from "../services/review.service.js";
import { AppError } from "../utils/appError.js";

const getAppointmentId = (req: Request) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) throw new AppError("Thiếu mã lịch hẹn", 400);
  return id;
};

const requirePatientId = (req: Request) => {
  if (!req.patient?.userId) throw new AppError("Vui lòng đăng nhập", 401);
  return req.patient.userId;
};

export const getPatientAppointmentReviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await ReviewService.getForPatient(
      getAppointmentId(req),
      requirePatientId(req),
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createPatientAppointmentReviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await ReviewService.create({
      appointmentId: getAppointmentId(req),
      patientId: requirePatientId(req),
      doctorRating: req.body.doctorRating,
      serviceRating: req.body.serviceRating,
      facilityRating: req.body.facilityRating,
      comment: req.body.comment,
    });
    return res
      .status(201)
      .json({ success: true, message: "Cảm ơn bạn đã gửi đánh giá", data });
  } catch (error) {
    next(error);
  }
};

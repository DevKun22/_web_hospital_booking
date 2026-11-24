import type { Request, Response } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import DoctorScheduleService from "../services/doctorSchedule.service.js";
import { AppError } from "../utils/appError.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};


const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role) {
    throw new AppError("Chưa đăng nhập", 401);
  }

  return {
    userId: req.user.userId,
    role: req.user.role as Role,
  };
};

export const listDoctorSchedulesHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DoctorScheduleService.list(
    {
      doctorId:
        parseStringQuery(req.query.doctorId),
      dayOfWeek: parseNumberQuery(req.query.dayOfWeek),
      isActive: parseBooleanQuery(req.query.isActive),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    },
    getActor(req),
  );

  return res.json({ success: true, data: result });
};

export const getDoctorScheduleHandler = async (
  req: Request,
  res: Response,
) => {
  const schedule = await DoctorScheduleService.getById(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  return res.json({ success: true, data: schedule });
};

export const createDoctorScheduleHandler = async (
  req: Request,
  res: Response,
) => {
  const schedule = await DoctorScheduleService.create(req.body);

  return res.status(201).json({
    success: true,
    message: "Tạo lịch làm việc thành công",
    data: schedule,
  });
};

export const updateDoctorScheduleHandler = async (
  req: Request,
  res: Response,
) => {
  const schedule = await DoctorScheduleService.update(
    getRequiredPathParam(req.params.id),
    req.body,
  );

  return res.json({
    success: true,
    message: "Cập nhật lịch làm việc thành công",
    data: schedule,
  });
};

export const deleteDoctorScheduleHandler = async (
  req: Request,
  res: Response,
) => {
  const schedule = await DoctorScheduleService.delete(
    getRequiredPathParam(req.params.id),
  );

  return res.json({
    success: true,
    message: "Xóa lịch làm việc thành công",
    data: schedule,
  });
};

import type { Request, Response, NextFunction } from "express";
import type { Role, TimeSlotStatus } from "../../generated/prisma/enums.js";
import DoctorTimeSlotService from "../services/doctorTimeSlot.service.js";
import ScheduleReconciliationService from "../services/scheduleReconciliation.service.js";
import { AppError } from "../utils/appError.js";

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

const getParam = (value: string | string[] | undefined, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
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

export const listDoctorTimeSlotsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await DoctorTimeSlotService.list(
      {
        doctorId:
          typeof req.query.doctorId === "string"
            ? req.query.doctorId
            : undefined,
        date: typeof req.query.date === "string" ? req.query.date : undefined,
        status:
          typeof req.query.status === "string"
            ? (req.query.status as TimeSlotStatus)
            : undefined,
        isActive: parseBooleanQuery(req.query.isActive),
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

export const getDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slot = await DoctorTimeSlotService.getById(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({ success: true, data: slot });
  } catch (error) {
    next(error);
  }
};

export const generateDoctorTimeSlotsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await DoctorTimeSlotService.generate(req.body);

    return res.status(201).json({
      success: true,
      message: "Tạo slot khám thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDoctorTimeSlotStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slot = await DoctorTimeSlotService.updateStatus(
      getParam(req.params.id),
      req.body.status,
      req.body.lockReason,
    );

    return res.json({
      success: true,
      message: "Cập nhật trạng thái slot thành công",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

export const lockDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slot = await DoctorTimeSlotService.lock(
      getParam(req.params.id),
      req.body.lockReason,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Khóa slot thành công",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

export const unlockDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slot = await DoctorTimeSlotService.unlock(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Mở khóa slot thành công",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slot = await DoctorTimeSlotService.delete(getParam(req.params.id));

    return res.json({
      success: true,
      message: "Xóa slot thành công",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

export const reconcileDoctorTimeSlotsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await ScheduleReconciliationService.reconcile({
      repair: req.body?.repair !== false,
      batchSize:
        typeof req.body?.batchSize === "number" ? req.body.batchSize : undefined,
    });
    return res.json({
      success: true,
      message: "Đã đối soát tính nhất quán của slot khám",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listPublicAvailableSlotsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slots = await DoctorTimeSlotService.getPublicAvailableSlots(
      getParam(req.params.id, "doctorId"),
      typeof req.query.date === "string" ? req.query.date : "",
    );

    return res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

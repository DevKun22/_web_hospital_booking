import SlotPlannerService from "../services/slotPlanner.service.js";
import type { Request, Response } from "express";
import { Role, TimeSlotStatus } from "../../generated/prisma/enums.js";
import DoctorTimeSlotService from "../services/doctorTimeSlot.service.js";
import ScheduleReconciliationService from "../services/scheduleReconciliation.service.js";
import { AppError } from "../utils/appError.js";
import { getRequiredPathParam, parseEnumQuery, parseStringQuery } from "../shared/http/requestParsers.js";

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

export const listDoctorTimeSlotsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DoctorTimeSlotService.list(
    {
      doctorId:
        parseStringQuery(req.query.doctorId),
      date: parseStringQuery(req.query.date),
      status:
        parseEnumQuery(req.query.status, TimeSlotStatus, "status"),
      isActive: parseBooleanQuery(req.query.isActive),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    },
    getActor(req),
  );

  return res.json({ success: true, data: result });
};

export const getDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
) => {
  const slot = await DoctorTimeSlotService.getById(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  return res.json({ success: true, data: slot });
};

export const generateDoctorTimeSlotsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DoctorTimeSlotService.generate(req.body);

  return res.status(201).json({
    success: true,
    message: "Tạo slot khám thành công",
    data: result,
  });
};

export const updateDoctorTimeSlotStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const slot = await DoctorTimeSlotService.updateStatus(
    getRequiredPathParam(req.params.id),
    req.body.status,
    req.body.lockReason,
  );

  return res.json({
    success: true,
    message: "Cập nhật trạng thái slot thành công",
    data: slot,
  });
};

export const lockDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
) => {
  const slot = await DoctorTimeSlotService.lock(
    getRequiredPathParam(req.params.id),
    req.body.lockReason,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Khóa slot thành công",
    data: slot,
  });
};

export const unlockDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
) => {
  const slot = await DoctorTimeSlotService.unlock(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Mở khóa slot thành công",
    data: slot,
  });
};

export const deleteDoctorTimeSlotHandler = async (
  req: Request,
  res: Response,
) => {
  const slot = await DoctorTimeSlotService.delete(getRequiredPathParam(req.params.id));

  return res.json({
    success: true,
    message: "Xóa slot thành công",
    data: slot,
  });
};

export const reconcileDoctorTimeSlotsHandler = async (
  req: Request,
  res: Response,
) => {
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
};

export const listPublicAvailableSlotsHandler = async (
  req: Request,
  res: Response,
) => {
  const slots = await DoctorTimeSlotService.getPublicAvailableSlots(
    getRequiredPathParam(req.params.id, "doctorId"),
    typeof req.query.date === "string" ? req.query.date : "",
  );

  return res.json({
    success: true,
    data: slots,
  });
};

export const listPublicAvailableDatesHandler = async (
  req: Request,
  res: Response,
) => {
  const dates = await DoctorTimeSlotService.getPublicAvailableDates(
    getRequiredPathParam(req.params.id, "doctorId"),
    typeof req.query.from === "string" ? req.query.from : "",
    typeof req.query.to === "string" ? req.query.to : "",
  );

  return res.json({ success: true, data: dates });
};

const requireActor = (req: Request) => {
  if (!req.user) throw new AppError("Vui lòng đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role as Role };
};

export const generateRangeHandler = async (req: Request, res: Response) => {
  const data = await SlotPlannerService.generateForRange(req.body);
  return res.status(201).json({ success: true, message: "Đã sinh khung giờ", data });
};

export const closeRangeHandler = async (req: Request, res: Response) => {
  const data = await SlotPlannerService.closeRange(req.body, requireActor(req));
  return res.json({ success: true, message: "Đã đóng lịch trong khoảng ngày", data });
};

export const reopenRangeHandler = async (req: Request, res: Response) => {
  const data = await SlotPlannerService.reopenRange(req.body, requireActor(req));
  return res.json({ success: true, message: "Đã mở lại lịch trong khoảng ngày", data });
};

import type { Request, Response } from "express";
import {
  Role,
  ScheduleChangeRequestStatus,
} from "../../generated/prisma/enums.js";
import ScheduleChangeRequestService from "../services/scheduleChangeRequest.service.js";
import { AppError } from "../utils/appError.js";
import { parseEnumQuery, parseStringQuery } from "../shared/http/requestParsers.js";

const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role)
    throw new AppError("Chưa đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role as Role };
};

const getId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) throw new AppError("Thiếu mã yêu cầu", 400);
  return id;
};

const numberQuery = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Number(value))
    ? Number(value)
    : undefined;

export const listScheduleChangeRequestsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await ScheduleChangeRequestService.list(
    {
      status:
        parseEnumQuery(req.query.status, ScheduleChangeRequestStatus, "status"),
      doctorId:
        parseStringQuery(req.query.doctorId),
      page: numberQuery(req.query.page),
      limit: numberQuery(req.query.limit),
    },
    getActor(req),
  );
  return res.json({ success: true, data });
};

export const createScheduleChangeRequestHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await ScheduleChangeRequestService.create(
    req.body,
    getActor(req),
  );
  return res
    .status(201)
    .json({
      success: true,
      message:
        "Đã gửi yêu cầu đổi lịch để chờ duyệt",
      data,
    });
};

export const reviewScheduleChangeRequestHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await ScheduleChangeRequestService.review(
    getId(req.params.id),
    req.body,
    getActor(req),
  );
  return res.json({
    success: true,
    message:
      req.body.status === "APPROVED"
        ? "Đã duyệt và áp dụng lịch mẫu"
        : "Đã từ chối yêu cầu đổi lịch",
    data,
  });
};

export const cancelScheduleChangeRequestHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await ScheduleChangeRequestService.cancel(
    getId(req.params.id),
    getActor(req),
  );
  return res.json({
    success: true,
    message:
      "Đã hủy yêu cầu đổi lịch",
    data,
  });
};

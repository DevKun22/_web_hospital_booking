import type { NextFunction, Request, Response } from "express";
import HospitalAnnouncementService from "../services/hospitalAnnouncement.service.js";
import { AppError } from "../utils/appError.js";

const requireDashboardUserId = (req: Request) => {
  if (!req.user?.userId) throw new AppError("Vui lòng đăng nhập", 401);
  return req.user.userId;
};

const parseOptionalDate = (value: unknown) =>
  typeof value === "string" && value ? new Date(value) : undefined;

export const createHospitalAnnouncementHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await HospitalAnnouncementService.create({
      createdById: requireDashboardUserId(req),
      title: req.body.title,
      body: req.body.body,
      scheduledAt: parseOptionalDate(req.body.scheduledAt),
      expiresAt: parseOptionalDate(req.body.expiresAt),
      audience: req.body.audience,
      departmentId: req.body.departmentId,
    });
    return res.status(201).json({
      success: true,
      message: data.publishedAt
        ? "Đã phát hành thông báo"
        : "Đã lên lịch thông báo",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listHospitalAnnouncementsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawLimit = Number(req.query.limit || 20);
    const data = await HospitalAnnouncementService.listRecent(
      Number.isFinite(rawLimit) ? rawLimit : 20,
    );
    return res.json({ success: true, data: { items: data } });
  } catch (error) {
    next(error);
  }
};

export const cancelHospitalAnnouncementHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawId = req.params.campaignId;
    const campaignId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!campaignId) throw new AppError("Thiếu mã chiến dịch", 400);
    const data = await HospitalAnnouncementService.cancelScheduled(campaignId);
    return res.json({ success: true, message: "Đã hủy lịch gửi", data });
  } catch (error) {
    next(error);
  }
};

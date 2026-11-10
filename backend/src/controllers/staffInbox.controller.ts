import type { NextFunction, Request, Response } from "express";
import NotificationService from "../services/notification.service.js";
import { AppError } from "../utils/appError.js";
import { parsePagination } from "../utils/pagination.js";

const requireUserId = (req: Request) => {
  if (!req.user?.userId) throw new AppError("Vui lòng đăng nhập", 401);
  return req.user.userId;
};

export const listStaffInboxHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await NotificationService.listForPatient({
      userId: requireUserId(req),
      page: pagination.page,
      limit: pagination.limit,
      unreadOnly: req.query.unread === "true",
    });
    return res.json({
      success: true,
      data: { items: result.items, meta: result.meta },
    });
  } catch (error) {
    next(error);
  }
};

export const getStaffInboxUnreadCountHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const unreadCount = await NotificationService.unreadCount(requireUserId(req));
    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
};

export const markStaffInboxReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id) throw new AppError("Thiếu mã thông báo", 400);
    const data = await NotificationService.markRead(requireUserId(req), id);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const markAllStaffInboxReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await NotificationService.markAllRead(requireUserId(req));
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

import type { Request, Response } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import ReviewService from "../services/review.service.js";
import { AppError } from "../utils/appError.js";
import { parseStringQuery } from "../shared/http/requestParsers.js";

const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role)
    throw new AppError("Chưa đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role as Role };
};

const numberQuery = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Number(value))
    ? Number(value)
    : undefined;

export const listDashboardReviewsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await ReviewService.dashboardList(
    {
      doctorId:
        parseStringQuery(req.query.doctorId),
      minRating: numberQuery(req.query.minRating),
      page: numberQuery(req.query.page),
      limit: numberQuery(req.query.limit),
    },
    getActor(req),
  );
  return res.json({ success: true, data });
};

export const updateDashboardReviewVisibilityHandler = async (
  req: Request,
  res: Response,
) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) throw new AppError("Thiếu mã đánh giá", 400);
  const data = await ReviewService.updateVisibility(id, {
    isVisible: req.body.isVisible,
    moderationNote: req.body.moderationNote,
  });
  return res.json({
    success: true,
    message: req.body.isVisible
      ? "Đã công khai đánh giá"
      : "Đã ẩn đánh giá khỏi website",
    data,
  });
};

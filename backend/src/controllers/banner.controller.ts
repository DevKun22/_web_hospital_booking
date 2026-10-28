import type { Request, Response, NextFunction } from "express";
import BannerService from "../services/banner.service.js";
import { AppError } from "../utils/appError.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const getParam = (value: string | string[] | undefined) => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError("Thiếu id", 400);
  }

  return param;
};

export const listPublicBannersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const items = await BannerService.listPublic({
      position:
        typeof req.query.position === "string" ? req.query.position : undefined,
    });

    return res.json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
};

export const listDashboardBannersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const items = await BannerService.listDashboard({
      position:
        typeof req.query.position === "string" ? req.query.position : undefined,
      isActive: parseBooleanQuery(req.query.isActive),
    });

    return res.json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
};

export const getDashboardBannerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const banner = await BannerService.getById(getParam(req.params.id));

    return res.json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

export const createDashboardBannerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const banner = await BannerService.create(req.body);
    PublicBootstrapService.invalidate();

    return res.status(201).json({
      success: true,
      message: "Tạo banner thành công",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboardBannerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const banner = await BannerService.update(
      getParam(req.params.id),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật banner thành công",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDashboardBannerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const banner = await BannerService.delete(getParam(req.params.id));
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Xóa banner thành công",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

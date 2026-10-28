import type { Request, Response, NextFunction } from "express";
import PublicFAQService from "../services/publicFAQ.service.js";
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

export const listPublicFAQsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const items = await PublicFAQService.listPublic({
      category:
        typeof req.query.category === "string" ? req.query.category : undefined,
    });

    return res.json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
};

export const listDashboardFAQsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const items = await PublicFAQService.listDashboard({
      category:
        typeof req.query.category === "string" ? req.query.category : undefined,
      isActive: parseBooleanQuery(req.query.isActive),
    });

    return res.json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
};

export const getDashboardFAQHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faq = await PublicFAQService.getById(getParam(req.params.id));

    return res.json({ success: true, data: faq });
  } catch (error) {
    next(error);
  }
};

export const createDashboardFAQHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faq = await PublicFAQService.create(req.body);
    PublicBootstrapService.invalidate();

    return res.status(201).json({
      success: true,
      message: "Tạo FAQ thành công",
      data: faq,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboardFAQHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faq = await PublicFAQService.update(
      getParam(req.params.id),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật FAQ thành công",
      data: faq,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDashboardFAQHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faq = await PublicFAQService.delete(getParam(req.params.id));
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Xóa FAQ thành công",
      data: faq,
    });
  } catch (error) {
    next(error);
  }
};

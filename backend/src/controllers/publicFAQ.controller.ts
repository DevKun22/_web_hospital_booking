import type { Request, Response } from "express";
import PublicFAQService from "../services/faq.service.js";
import { AppError } from "../utils/appError.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};


export const listPublicFAQsHandler = async (
  req: Request,
  res: Response,
) => {
  const items = await PublicFAQService.listPublic({
    category:
      parseStringQuery(req.query.category),
  });

  return res.json({ success: true, data: { items } });
};

export const listDashboardFAQsHandler = async (
  req: Request,
  res: Response,
) => {
  const items = await PublicFAQService.listDashboard({
    category:
      parseStringQuery(req.query.category),
    isActive: parseBooleanQuery(req.query.isActive),
  });

  return res.json({ success: true, data: { items } });
};

export const getDashboardFAQHandler = async (
  req: Request,
  res: Response,
) => {
  const faq = await PublicFAQService.getById(getRequiredPathParam(req.params.id));

  return res.json({ success: true, data: faq });
};

export const createDashboardFAQHandler = async (
  req: Request,
  res: Response,
) => {
  const faq = await PublicFAQService.create(req.body);
  PublicBootstrapService.invalidate();

  return res.status(201).json({
    success: true,
    message: "Tạo FAQ thành công",
    data: faq,
  });
};

export const updateDashboardFAQHandler = async (
  req: Request,
  res: Response,
) => {
  const faq = await PublicFAQService.update(
    getRequiredPathParam(req.params.id),
    req.body,
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật FAQ thành công",
    data: faq,
  });
};

export const deleteDashboardFAQHandler = async (
  req: Request,
  res: Response,
) => {
  const faq = await PublicFAQService.delete(getRequiredPathParam(req.params.id));
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Xóa FAQ thành công",
    data: faq,
  });
};

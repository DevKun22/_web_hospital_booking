import type { Request, Response } from "express";
import BannerService from "../services/banner.service.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};


export const listPublicBannersHandler = async (
  req: Request,
  res: Response,
) => {
  const items = await BannerService.listPublic({
    position:
      parseStringQuery(req.query.position),
  });

  return res.json({ success: true, data: { items } });
};

export const listDashboardBannersHandler = async (
  req: Request,
  res: Response,
) => {
  const items = await BannerService.listDashboard({
    position:
      parseStringQuery(req.query.position),
    isActive: parseBooleanQuery(req.query.isActive),
  });

  return res.json({ success: true, data: { items } });
};

export const getDashboardBannerHandler = async (
  req: Request,
  res: Response,
) => {
  const banner = await BannerService.getById(getRequiredPathParam(req.params.id));

  return res.json({ success: true, data: banner });
};

export const createDashboardBannerHandler = async (
  req: Request,
  res: Response,
) => {
  const banner = await BannerService.create(req.body);
  PublicBootstrapService.invalidate();

  return res.status(201).json({
    success: true,
    message: "Tạo banner thành công",
    data: banner,
  });
};

export const updateDashboardBannerHandler = async (
  req: Request,
  res: Response,
) => {
  const banner = await BannerService.update(
    getRequiredPathParam(req.params.id),
    req.body,
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật banner thành công",
    data: banner,
  });
};

export const deleteDashboardBannerHandler = async (
  req: Request,
  res: Response,
) => {
  const banner = await BannerService.delete(getRequiredPathParam(req.params.id));
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Xóa banner thành công",
    data: banner,
  });
};

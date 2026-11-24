import type { Request, Response } from "express";
import SiteSettingsService from "../services/siteSettings.service.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";

export const getPublicSiteSettingsHandler = async (
  _req: Request,
  res: Response,
) => {
  const settings = await SiteSettingsService.get();

  return res.json({
    success: true,
    data: settings.value,
  });
};

export const getDashboardSiteSettingsHandler = async (
  _req: Request,
  res: Response,
) => {
  const settings = await SiteSettingsService.get();

  return res.json({
    success: true,
    data: settings,
  });
};

export const updateDashboardSiteSettingsHandler = async (
  req: Request,
  res: Response,
) => {
  const settings = await SiteSettingsService.update(req.body);
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật cấu hình website thành công",
    data: settings,
  });
};

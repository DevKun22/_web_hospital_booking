import type { Request, Response, NextFunction } from "express";
import SiteSettingsService from "../services/siteSettings.service.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";

export const getPublicSiteSettingsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await SiteSettingsService.get();

    return res.json({
      success: true,
      data: settings.value,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardSiteSettingsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await SiteSettingsService.get();

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboardSiteSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await SiteSettingsService.update(req.body);
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật cấu hình website thành công",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

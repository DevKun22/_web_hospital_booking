import type { Request, Response } from "express";
import HomePageConfigService from "../services/homePageConfig.service.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";

export const getDashboardHomePageConfigHandler = async (
  _req: Request,
  res: Response,
) => {
  const setting = await HomePageConfigService.get();
  return res.json({ success: true, data: setting });
};

export const updateDashboardHomePageConfigHandler = async (
  req: Request,
  res: Response,
) => {
  const setting = await HomePageConfigService.update(req.body);
  PublicBootstrapService.invalidate();
  return res.json({
    success: true,
    message: "Cập nhật cấu hình trang chủ thành công",
    data: setting,
  });
};

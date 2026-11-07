import { Router } from "express";
import {
  createDashboardBannerHandler,
  deleteDashboardBannerHandler,
  getDashboardBannerHandler,
  listDashboardBannersHandler,
  listPublicBannersHandler,
  updateDashboardBannerHandler,
} from "../controllers/banner.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createBannerSchema,
  updateBannerSchema,
} from "../validations/siteConfig.validation.js";

export const publicBannerRouter = Router();
publicBannerRouter.get("/", listPublicBannersHandler);

export const dashboardBannerRouter = Router();
dashboardBannerRouter.use(authDashboard);
dashboardBannerRouter.get(
  "/",
  requirePermission("content.manage"),
  listDashboardBannersHandler,
);
dashboardBannerRouter.get(
  "/:id",
  requirePermission("content.manage"),
  getDashboardBannerHandler,
);
dashboardBannerRouter.post(
  "/",
  requirePermission("content.manage"),
  validate(createBannerSchema),
  createDashboardBannerHandler,
);
dashboardBannerRouter.patch(
  "/:id",
  requirePermission("content.manage"),
  validate(updateBannerSchema),
  updateDashboardBannerHandler,
);
dashboardBannerRouter.delete(
  "/:id",
  requirePermission("content.delete"),
  deleteDashboardBannerHandler,
);

import { Router } from "express";
import {
  getDashboardSiteSettingsHandler,
  getPublicSiteSettingsHandler,
  updateDashboardSiteSettingsHandler,
} from "../controllers/siteSettings.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateSiteSettingsSchema } from "../validations/siteConfig.validation.js";

export const publicSiteSettingsRouter = Router();
publicSiteSettingsRouter.get("/", getPublicSiteSettingsHandler);

export const dashboardSiteSettingsRouter = Router();
dashboardSiteSettingsRouter.use(authDashboard);
dashboardSiteSettingsRouter.get(
  "/",
  requirePermission("settings.view"),
  getDashboardSiteSettingsHandler,
);
dashboardSiteSettingsRouter.patch(
  "/",
  requirePermission("settings.edit"),
  validate(updateSiteSettingsSchema),
  updateDashboardSiteSettingsHandler,
);

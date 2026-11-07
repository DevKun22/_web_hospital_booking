import { Router } from "express";
import {
  getDashboardHomePageConfigHandler,
  updateDashboardHomePageConfigHandler,
} from "../controllers/homePageConfig.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateHomePageConfigSchema } from "../validations/siteConfig.validation.js";

const router = Router();

router.use(authDashboard);
router.get(
  "/",
  requirePermission("settings.view"),
  getDashboardHomePageConfigHandler,
);
router.patch(
  "/",
  requirePermission("settings.edit"),
  validate(updateHomePageConfigSchema),
  updateDashboardHomePageConfigHandler,
);

export default router;

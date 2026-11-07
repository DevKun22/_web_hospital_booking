import { Router } from "express";
import {
  getDashboardHomePageConfigHandler,
  updateDashboardHomePageConfigHandler,
} from "../controllers/homePageConfig.controller.js";
import { authDashboard, requireRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateHomePageConfigSchema } from "../validations/siteConfig.validation.js";

const router = Router();

router.use(authDashboard);
router.get(
  "/",
  requireRole("ADMIN", "STAFF"),
  getDashboardHomePageConfigHandler,
);
router.patch(
  "/",
  requireRole("ADMIN"),
  validate(updateHomePageConfigSchema),
  updateDashboardHomePageConfigHandler,
);

export default router;

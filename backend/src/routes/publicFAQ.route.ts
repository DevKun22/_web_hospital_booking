import { Router } from "express";
import {
  createDashboardFAQHandler,
  deleteDashboardFAQHandler,
  getDashboardFAQHandler,
  listDashboardFAQsHandler,
  listPublicFAQsHandler,
  updateDashboardFAQHandler,
} from "../controllers/publicFAQ.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPublicFAQSchema,
  updatePublicFAQSchema,
} from "../validations/siteConfig.validation.js";

export const publicFAQRouter = Router();
publicFAQRouter.get("/", listPublicFAQsHandler);

export const dashboardFAQRouter = Router();
dashboardFAQRouter.use(authDashboard);
dashboardFAQRouter.get(
  "/",
  requirePermission("content.manage"),
  listDashboardFAQsHandler,
);
dashboardFAQRouter.get(
  "/:id",
  requirePermission("content.manage"),
  getDashboardFAQHandler,
);
dashboardFAQRouter.post(
  "/",
  requirePermission("content.manage"),
  validate(createPublicFAQSchema),
  createDashboardFAQHandler,
);
dashboardFAQRouter.patch(
  "/:id",
  requirePermission("content.manage"),
  validate(updatePublicFAQSchema),
  updateDashboardFAQHandler,
);
dashboardFAQRouter.delete(
  "/:id",
  requirePermission("content.delete"),
  deleteDashboardFAQHandler,
);

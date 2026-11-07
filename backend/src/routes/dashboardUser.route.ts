import { Router } from "express";
import {
  createDashboardUserHandler,
  getDashboardUserHandler,
  listDashboardUsersHandler,
  updateDashboardUserHandler,
  updateDashboardUserPasswordHandler,
  updateDashboardUserStatusHandler,
} from "../controllers/dashboardUser.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createDashboardUserSchema,
  updateDashboardUserPasswordSchema,
  updateDashboardUserSchema,
  updateDashboardUserStatusSchema,
} from "../validations/dashboardUser.validation.js";

const router = Router();

router.use(authDashboard, requirePermission("user.manage"));

router.get("/", listDashboardUsersHandler);
router.post(
  "/",
  validate(createDashboardUserSchema),
  createDashboardUserHandler,
);
router.get("/:id", getDashboardUserHandler);
router.patch(
  "/:id",
  validate(updateDashboardUserSchema),
  updateDashboardUserHandler,
);
router.patch(
  "/:id/status",
  validate(updateDashboardUserStatusSchema),
  updateDashboardUserStatusHandler,
);
router.patch(
  "/:id/password",
  validate(updateDashboardUserPasswordSchema),
  updateDashboardUserPasswordHandler,
);

export default router;

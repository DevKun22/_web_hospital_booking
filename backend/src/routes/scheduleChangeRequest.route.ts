import { Router } from "express";
import {
  cancelScheduleChangeRequestHandler,
  createScheduleChangeRequestHandler,
  listScheduleChangeRequestsHandler,
  reviewScheduleChangeRequestHandler,
} from "../controllers/scheduleChangeRequest.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createScheduleChangeRequestSchema,
  reviewScheduleChangeRequestSchema,
} from "../validations/scheduleChangeRequest.validation.js";

const router = Router();
router.use(authDashboard);
router.get(
  "/",
  requirePermission("schedule.view"),
  listScheduleChangeRequestsHandler,
);
router.post(
  "/",
  requirePermission("schedule.request"),
  validate(createScheduleChangeRequestSchema),
  createScheduleChangeRequestHandler,
);
router.patch(
  "/:id/review",
  requirePermission("schedule.review"),
  validate(reviewScheduleChangeRequestSchema),
  reviewScheduleChangeRequestHandler,
);
router.patch(
  "/:id/cancel",
  requirePermission("schedule.request"),
  cancelScheduleChangeRequestHandler,
);

export default router;

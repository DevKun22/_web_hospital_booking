import { Router } from "express";
import {
  listDashboardReviewsHandler,
  updateDashboardReviewVisibilityHandler,
} from "../controllers/dashboardReview.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateReviewVisibilitySchema } from "../validations/review.validation.js";

const router = Router();

router.use(authDashboard);
router.get(
  "/",
  requirePermission("review.view"),
  listDashboardReviewsHandler,
);
router.patch(
  "/:id/visibility",
  requirePermission("review.moderate"),
  validate(updateReviewVisibilitySchema),
  updateDashboardReviewVisibilityHandler,
);

export default router;

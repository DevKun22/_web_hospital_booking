import { Router } from "express";
import {
  getPolicyHandler,
  resetPolicyHandler,
  updatePolicyHandler,
} from "../controllers/policy.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updatePolicySchema } from "../validations/policy.validation.js";

const router = Router();

router.use(authDashboard);

router.get("/", requirePermission("settings.view"), getPolicyHandler);
router.put(
  "/",
  requirePermission("settings.edit"),
  validate(updatePolicySchema),
  updatePolicyHandler,
);
router.delete("/", requirePermission("settings.edit"), resetPolicyHandler);

export default router;

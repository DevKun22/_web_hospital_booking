import { Router } from "express";
import {
  getRbacMatrixHandler,
  resetRbacMatrixHandler,
  updateRbacMatrixHandler,
} from "../controllers/rbac.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateRbacMatrixSchema } from "../validations/rbac.validation.js";

const router = Router();

router.use(authDashboard, requirePermission("rbac.manage"));

router.get("/", getRbacMatrixHandler);
router.put("/", validate(updateRbacMatrixSchema), updateRbacMatrixHandler);
router.delete("/", resetRbacMatrixHandler);

export default router;

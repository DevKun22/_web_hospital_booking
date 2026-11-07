import { Router } from "express";
import {
  createDepartmentHandler,
  deleteDepartmentHandler,
  getDepartmentHandler,
  listDepartmentsHandler,
  updateDepartmentHandler,
} from "../controllers/department.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../validations/department.validation.js";

const router = Router();

router.use(authDashboard);

router.get(
  "/",
  requirePermission("catalog.view"),
  listDepartmentsHandler,
);
router.get(
  "/:id",
  requirePermission("catalog.view"),
  getDepartmentHandler,
);
router.post(
  "/",
  requirePermission("catalog.manage"),
  validate(createDepartmentSchema),
  createDepartmentHandler,
);
router.patch(
  "/:id",
  requirePermission("catalog.manage"),
  validate(updateDepartmentSchema),
  updateDepartmentHandler,
);
router.delete("/:id", requirePermission("catalog.delete"), deleteDepartmentHandler);

export default router;

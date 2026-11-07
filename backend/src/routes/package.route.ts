import { Router } from "express";
import {
  createPackageHandler,
  createPackageItemHandler,
  deletePackageHandler,
  deletePackageItemHandler,
  getPackageHandler,
  listPackagesHandler,
  updatePackageHandler,
  updatePackageItemHandler,
} from "../controllers/package.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPackageItemSchema,
  createPackageSchema,
  updatePackageItemSchema,
  updatePackageSchema,
} from "../validations/package.validation.js";

const router = Router();

router.use(authDashboard);

router.get("/", requirePermission("catalog.view"), listPackagesHandler);
router.get("/:id", requirePermission("catalog.view"), getPackageHandler);
router.post(
  "/",
  requirePermission("catalog.manage"),
  validate(createPackageSchema),
  createPackageHandler,
);
router.patch(
  "/:id",
  requirePermission("catalog.manage"),
  validate(updatePackageSchema),
  updatePackageHandler,
);
router.delete("/:id", requirePermission("catalog.delete"), deletePackageHandler);
router.post(
  "/:id/items",
  requirePermission("catalog.manage"),
  validate(createPackageItemSchema),
  createPackageItemHandler,
);
router.patch(
  "/:id/items/:itemId",
  requirePermission("catalog.manage"),
  validate(updatePackageItemSchema),
  updatePackageItemHandler,
);
router.delete(
  "/:id/items/:itemId",
  requirePermission("catalog.manage"),
  deletePackageItemHandler,
);

export default router;

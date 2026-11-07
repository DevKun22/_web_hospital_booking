import { Router } from "express";
import {
  cancelPrescriptionHandler,
  createPrescriptionItemHandler,
  deletePrescriptionItemHandler,
  getPrescriptionHandler,
  issuePrescriptionHandler,
  listPrescriptionsHandler,
  updatePrescriptionHandler,
  updatePrescriptionItemHandler,
} from "../controllers/prescription.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createPrescriptionItemSchema,
  updatePrescriptionItemSchema,
  updatePrescriptionSchema,
} from "../validations/prescription.validation.js";

const router = Router();

router.use(authDashboard);

router.get(
  "/",
  requirePermission("prescription.view"),
  listPrescriptionsHandler,
);
router.get(
  "/:id",
  requirePermission("prescription.view"),
  getPrescriptionHandler,
);
router.patch(
  "/:id",
  requirePermission("prescription.write"),
  validate(updatePrescriptionSchema),
  updatePrescriptionHandler,
);
router.patch(
  "/:id/issue",
  requirePermission("prescription.write"),
  issuePrescriptionHandler,
);
router.patch(
  "/:id/cancel",
  requirePermission("prescription.write"),
  cancelPrescriptionHandler,
);
router.post(
  "/:id/items",
  requirePermission("prescription.write"),
  validate(createPrescriptionItemSchema),
  createPrescriptionItemHandler,
);
router.patch(
  "/:id/items/:itemId",
  requirePermission("prescription.write"),
  validate(updatePrescriptionItemSchema),
  updatePrescriptionItemHandler,
);
router.delete(
  "/:id/items/:itemId",
  requirePermission("prescription.write"),
  deletePrescriptionItemHandler,
);

export default router;

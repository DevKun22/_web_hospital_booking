import { Router } from "express";
import {
  adjustStockHandler,
  createMedicineHandler,
  dispensePrescriptionHandler,
  getMedicineHandler,
  getPrescriptionHandler,
  listMedicinesHandler,
  listMovementsHandler,
  listPrescriptionsHandler,
  receiveStockHandler,
  updateMedicineHandler,
} from "../controllers/pharmacy.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  adjustStockSchema,
  createMedicineSchema,
  dispenseSchema,
  receiveStockSchema,
  updateMedicineSchema,
} from "../validations/pharmacy.validation.js";

const router = Router();

router.use(authDashboard);

// Đơn chờ cấp và cấp thuốc
router.get("/prescriptions", requirePermission("pharmacy.view"), listPrescriptionsHandler);
router.get("/prescriptions/:id", requirePermission("pharmacy.view"), getPrescriptionHandler);
router.post(
  "/prescriptions/:id/dispense",
  requirePermission("pharmacy.dispense"),
  validate(dispenseSchema),
  dispensePrescriptionHandler,
);

// Danh mục thuốc
router.get("/medicines", requirePermission("pharmacy.view"), listMedicinesHandler);
router.post(
  "/medicines",
  requirePermission("pharmacy.catalog"),
  validate(createMedicineSchema),
  createMedicineHandler,
);
router.get("/medicines/:id", requirePermission("pharmacy.view"), getMedicineHandler);
router.patch(
  "/medicines/:id",
  requirePermission("pharmacy.catalog"),
  validate(updateMedicineSchema),
  updateMedicineHandler,
);

// Sổ kho
router.get("/medicines/:id/movements", requirePermission("pharmacy.view"), listMovementsHandler);
router.post(
  "/medicines/:id/receipts",
  requirePermission("pharmacy.receive"),
  validate(receiveStockSchema),
  receiveStockHandler,
);
router.post(
  "/medicines/:id/adjustments",
  requirePermission("pharmacy.adjust"),
  validate(adjustStockSchema),
  adjustStockHandler,
);

export default router;

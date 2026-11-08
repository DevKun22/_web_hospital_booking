import { Router } from "express";
import {
  adjustStockHandler,
  createMedicineHandler,
  dispensePrescriptionHandler,
  getMedicineHandler,
  getPrescriptionHandler,
  importCatalogHandler,
  importReceiptsHandler,
  listMedicinesHandler,
  listMovementsHandler,
  listPrescriptionsHandler,
  receiveStockHandler,
  updateMedicineHandler,
} from "../controllers/pharmacy.controller.js";
import {
  exportInventoryHandler,
  exportMovementsHandler,
} from "../controllers/dataExport.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  adjustStockSchema,
  createMedicineSchema,
  dispenseSchema,
  importCsvSchema,
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
// Xuất báo cáo: đứng trước "/medicines/:id".
router.get("/medicines/export", requirePermission("pharmacy.view"), exportInventoryHandler);
router.get("/movements/export", requirePermission("pharmacy.view"), exportMovementsHandler);
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

// Nhập CSV: xem trước (apply=false) hoặc áp dụng (apply=true), hoặc đủ hoặc không.
router.post(
  "/import/catalog",
  requirePermission("pharmacy.catalog"),
  validate(importCsvSchema),
  importCatalogHandler,
);
router.post(
  "/import/receipts",
  requirePermission("pharmacy.receive"),
  validate(importCsvSchema),
  importReceiptsHandler,
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

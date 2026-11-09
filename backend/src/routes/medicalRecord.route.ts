import { Router } from "express";
import {
  archiveMedicalRecordHandler,
  createLabResultHandler,
  deleteLabResultHandler,
  downloadMedicalFileHandler,
  getMedicalRecordHandler,
  listMedicalRecordsHandler,
  publishMedicalRecordHandler,
  updateLabResultHandler,
  updateMedicalRecordHandler,
} from "../controllers/medicalRecord.controller.js";
import { createPrescriptionHandler as createPrescriptionFromRecordHandler } from "../controllers/prescription.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createLabResultSchema,
  updateLabResultSchema,
  updateMedicalRecordSchema,
} from "../validations/medicalRecord.validation.js";
import { createPrescriptionSchema as createPrescriptionValidationSchema } from "../validations/prescription.validation.js";

const router = Router();

router.use(authDashboard);

router.get(
  "/",
  requirePermission("record.view"),
  listMedicalRecordsHandler,
);
router.get(
  "/:id/file",
  requirePermission("record.view"),
  downloadMedicalFileHandler,
);
router.get(
  "/:id/lab-results/:labResultId/file",
  requirePermission("record.view"),
  downloadMedicalFileHandler,
);
router.get(
  "/:id",
  requirePermission("record.view"),
  getMedicalRecordHandler,
);
router.patch(
  "/:id",
  requirePermission("record.edit"),
  validate(updateMedicalRecordSchema),
  updateMedicalRecordHandler,
);
router.patch(
  "/:id/publish",
  requirePermission("record.edit"),
  publishMedicalRecordHandler,
);
router.patch(
  "/:id/archive",
  requirePermission("record.archive"),
  archiveMedicalRecordHandler,
);
router.post(
  "/:id/prescription",
  requirePermission("prescription.write"),
  validate(createPrescriptionValidationSchema),
  createPrescriptionFromRecordHandler,
);
router.post(
  "/:id/lab-results",
  requirePermission("record.edit"),
  validate(createLabResultSchema),
  createLabResultHandler,
);
router.patch(
  "/:id/lab-results/:labResultId",
  requirePermission("record.edit"),
  validate(updateLabResultSchema),
  updateLabResultHandler,
);
router.delete(
  "/:id/lab-results/:labResultId",
  requirePermission("record.edit"),
  deleteLabResultHandler,
);

export default router;

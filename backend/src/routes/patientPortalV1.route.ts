import { Router } from "express";
import {
  cancelPatientAppointmentHandler,
  downloadPatientMedicalFileHandler,
  getPatientAppointmentHandler,
  getPatientInvoiceHandler,
  getPatientMedicalRecordHandler,
  getPatientPrescriptionHandler,
  getPatientProfileHandler,
  listPatientAppointmentsHandler,
  listPatientInvoicesHandler,
  listPatientMedicalRecordsHandler,
  listPatientPrescriptionsHandler,
  updatePatientProfileHandler,
} from "../controllers/patientPortalV1.controller.js";
import { authPatient } from "../middlewares/patientAuth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { patientCancelAppointmentSchema, patientProfileUpdateSchema } from "../validations/patientV1.validation.js";

const router = Router();
router.use(authPatient);

router.get("/", getPatientProfileHandler);
router.patch("/", validate(patientProfileUpdateSchema), updatePatientProfileHandler);
router.get("/appointments", listPatientAppointmentsHandler);
router.get("/appointments/:id", getPatientAppointmentHandler);
router.post("/appointments/:id/cancel", validate(patientCancelAppointmentSchema), cancelPatientAppointmentHandler);
router.get("/medical-records", listPatientMedicalRecordsHandler);
router.get("/medical-records/:id", getPatientMedicalRecordHandler);
router.get("/medical-records/:id/file", downloadPatientMedicalFileHandler);
router.get("/medical-records/:id/lab-results/:labResultId/file", downloadPatientMedicalFileHandler);
router.get("/prescriptions", listPatientPrescriptionsHandler);
router.get("/prescriptions/:id", getPatientPrescriptionHandler);
router.get("/invoices", listPatientInvoicesHandler);
router.get("/invoices/:id", getPatientInvoiceHandler);

export default router;

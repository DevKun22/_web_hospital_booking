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
import {
  archivePatientDependentHandler,
  createPatientDependentHandler,
  listPatientDependentsHandler,
  updatePatientDependentHandler,
} from "../controllers/patientDependent.controller.js";
import {
  patientCancelAppointmentSchema,
  patientDependentCreateSchema,
  patientDependentUpdateSchema,
  patientProfileUpdateSchema,
} from "../validations/patientV1.validation.js";
import {
  createPatientPaymentHandler,
  getPatientPaymentCapabilitiesHandler,
  getPatientPaymentHandler,
  mockPatientPaymentFailHandler,
  mockPatientPaymentSuccessHandler,
} from "../controllers/patientPaymentV1.controller.js";
import { createPaymentTransactionSchema } from "../validations/payment.validation.js";
import {
  createPatientAppointmentReviewHandler,
  getPatientAppointmentReviewHandler,
} from "../controllers/review.controller.js";
import { createAppointmentReviewSchema } from "../validations/review.validation.js";

const router = Router();
router.use(authPatient);

router.get("/", getPatientProfileHandler);
router.patch("/", validate(patientProfileUpdateSchema), updatePatientProfileHandler);
router.get("/dependents", listPatientDependentsHandler);
router.post(
  "/dependents",
  validate(patientDependentCreateSchema),
  createPatientDependentHandler,
);
router.patch(
  "/dependents/:id",
  validate(patientDependentUpdateSchema),
  updatePatientDependentHandler,
);
router.delete("/dependents/:id", archivePatientDependentHandler);
router.get("/appointments", listPatientAppointmentsHandler);
router.get("/appointments/:id", getPatientAppointmentHandler);
router.post("/appointments/:id/cancel", validate(patientCancelAppointmentSchema), cancelPatientAppointmentHandler);
router.get("/appointments/:id/review", getPatientAppointmentReviewHandler);
router.post(
  "/appointments/:id/review",
  validate(createAppointmentReviewSchema),
  createPatientAppointmentReviewHandler,
);
router.get("/medical-records", listPatientMedicalRecordsHandler);
router.get("/medical-records/:id", getPatientMedicalRecordHandler);
router.get("/medical-records/:id/file", downloadPatientMedicalFileHandler);
router.get("/medical-records/:id/lab-results/:labResultId/file", downloadPatientMedicalFileHandler);
router.get("/prescriptions", listPatientPrescriptionsHandler);
router.get("/prescriptions/:id", getPatientPrescriptionHandler);
router.get("/invoices", listPatientInvoicesHandler);
router.get("/invoices/:id", getPatientInvoiceHandler);
router.get("/payment-capabilities", getPatientPaymentCapabilitiesHandler);
router.post(
  "/invoices/:invoiceId/payments",
  validate(createPaymentTransactionSchema),
  createPatientPaymentHandler,
);
router.get("/payments/:paymentId", getPatientPaymentHandler);
router.post("/payments/mock/:transactionCode/success", mockPatientPaymentSuccessHandler);
router.post("/payments/mock/:transactionCode/fail", mockPatientPaymentFailHandler);

export default router;

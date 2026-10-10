import { Router } from "express";
import {
  listPatientSessionsHandler,
  logoutPatientHandler,
  refreshPatientSessionHandler,
  requestPatientOtpHandler,
  revokePatientSessionHandler,
  verifyPatientOtpHandler,
} from "../controllers/patientAuthV1.controller.js";
import { authPatient } from "../middlewares/patientAuth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  patientLogoutSchema,
  patientRefreshSchema,
  patientRequestOtpSchema,
  patientVerifyOtpSchema,
} from "../validations/patientV1.validation.js";

const router = Router();

router.post("/patient/request-otp", validate(patientRequestOtpSchema), requestPatientOtpHandler);
router.post("/patient/verify-otp", validate(patientVerifyOtpSchema), verifyPatientOtpHandler);
router.post("/refresh", validate(patientRefreshSchema), refreshPatientSessionHandler);
router.post("/logout", validate(patientLogoutSchema), logoutPatientHandler);
router.get("/sessions", authPatient, listPatientSessionsHandler);
router.delete("/sessions/:id", authPatient, revokePatientSessionHandler);

export default router;

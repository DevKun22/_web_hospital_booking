import { Router } from "express";
import {
  abandonPendingAppointmentHandler,
  createAppointmentHandler,
  getPublicAppointmentResultHandler,
  requestPublicAppointmentCancelOtpHandler,
  requestPublicAppointmentLookupOtpHandler,
  verifyPublicAppointmentCancelHandler,
  resendAppointmentOtpHandler,
  verifyPublicAppointmentLookupOtpHandler,
  verifyAppointmentOtpHandler,
} from "../controllers/appointment.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { optionalAuthPatient } from "../middlewares/patientAuth.middleware.js";
import { requireLookupGrant } from "../middlewares/lookupGrant.middleware.js";
import reviewRouter from "./review.route.js";
import {
  abandonPendingAppointmentSchema,
  createAppointmentSchema,
  requestPublicCancelAppointmentOtpSchema,
  requestAppointmentLookupOtpSchema,
  verifyPublicCancelAppointmentSchema,
  verifyAppointmentLookupOtpSchema,
  verifyAppointmentOtpSchema,
} from "../validations/appointment.validation.js";

const router = Router();

router.use("/", reviewRouter);

router.post(
  "/",
  optionalAuthPatient,
  validate(createAppointmentSchema),
  createAppointmentHandler,
);
router.get(
  "/lookup/result",
  requireLookupGrant("results:read"),
  getPublicAppointmentResultHandler,
);
router.post(
  "/lookup/request-otp",
  validate(requestAppointmentLookupOtpSchema),
  requestPublicAppointmentLookupOtpHandler,
);
router.post(
  "/lookup/verify-otp",
  validate(verifyAppointmentLookupOtpSchema),
  verifyPublicAppointmentLookupOtpHandler,
);
router.post(
  "/lookup/cancel/request-otp",
  validate(requestPublicCancelAppointmentOtpSchema),
  requestPublicAppointmentCancelOtpHandler,
);
router.post(
  "/lookup/cancel/verify",
  validate(verifyPublicCancelAppointmentSchema),
  verifyPublicAppointmentCancelHandler,
);
router.post("/:id/resend-otp", resendAppointmentOtpHandler);
router.delete(
  "/:id/pending",
  validate(abandonPendingAppointmentSchema),
  abandonPendingAppointmentHandler,
);
router.post(
  "/:id/verify-otp",
  validate(verifyAppointmentOtpSchema),
  verifyAppointmentOtpHandler,
);

export default router;

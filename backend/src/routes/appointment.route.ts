import { Router } from "express";
import {
  abandonPendingAppointmentHandler,
  createAppointmentHandler,
  resendAppointmentOtpHandler,
  verifyAppointmentOtpHandler,
} from "../controllers/appointment.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { optionalAuthPatient } from "../middlewares/patientAuth.middleware.js";
import {
  bookingCreateIpLimiter,
  bookingCreatePhoneLimiter,
} from "../middlewares/publicRateLimits.js";
import {
  abandonPendingAppointmentSchema,
  createAppointmentSchema,
  verifyAppointmentOtpSchema,
} from "../validations/appointment.validation.js";

// Đặt lịch public. Tra cứu, hủy, xem kết quả, hóa đơn và đánh giá đều đi qua
// cổng bệnh nhân /api/v1/me sau khi đăng nhập bằng OTP.
const router = Router();

router.post(
  "/",
  bookingCreateIpLimiter,
  bookingCreatePhoneLimiter,
  optionalAuthPatient,
  validate(createAppointmentSchema),
  createAppointmentHandler,
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

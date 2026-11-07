import { Router } from "express";
import {
  cancelDashboardAppointmentHandler,
  checkInDashboardAppointmentHandler,
  completeDashboardAppointmentHandler,
  confirmDashboardAppointmentHandler,
  getDashboardAppointmentHandler,
  listDashboardAppointmentsHandler,
  noShowDashboardAppointmentHandler,
  rescheduleDashboardAppointmentHandler,
  startDashboardAppointmentHandler,
  updateDashboardAppointmentPatientInfoHandler,
} from "../controllers/appointment.controller.js";
import { authDashboard, requireRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentPatientInfoSchema,
} from "../validations/appointment.validation.js";

const router = Router();

router.use(authDashboard);

router.get(
  "/",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  listDashboardAppointmentsHandler,
);
router.get(
  "/:id",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  getDashboardAppointmentHandler,
);
router.patch(
  "/:id/confirm",
  requireRole("ADMIN", "STAFF"),
  confirmDashboardAppointmentHandler,
);
router.patch(
  "/:id/check-in",
  requireRole("ADMIN", "STAFF"),
  checkInDashboardAppointmentHandler,
);
router.patch(
  "/:id/start",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  startDashboardAppointmentHandler,
);
router.patch(
  "/:id/complete",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  completeDashboardAppointmentHandler,
);
router.patch(
  "/:id/no-show",
  requireRole("ADMIN", "STAFF"),
  noShowDashboardAppointmentHandler,
);
router.patch(
  "/:id/reschedule",
  requireRole("ADMIN", "STAFF"),
  validate(rescheduleAppointmentSchema),
  rescheduleDashboardAppointmentHandler,
);
router.patch(
  "/:id/patient-info",
  requireRole("ADMIN", "STAFF"),
  validate(updateAppointmentPatientInfoSchema),
  updateDashboardAppointmentPatientInfoHandler,
);
router.patch(
  "/:id/cancel",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  validate(cancelAppointmentSchema),
  cancelDashboardAppointmentHandler,
);

export default router;

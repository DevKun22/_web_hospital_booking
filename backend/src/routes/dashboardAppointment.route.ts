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
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
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
  requirePermission("appointment.view"),
  listDashboardAppointmentsHandler,
);
router.get(
  "/:id",
  requirePermission("appointment.view"),
  getDashboardAppointmentHandler,
);
router.patch(
  "/:id/confirm",
  requirePermission("appointment.front_desk"),
  confirmDashboardAppointmentHandler,
);
router.patch(
  "/:id/check-in",
  requirePermission("appointment.front_desk"),
  checkInDashboardAppointmentHandler,
);
router.patch(
  "/:id/start",
  requirePermission("appointment.exam"),
  startDashboardAppointmentHandler,
);
router.patch(
  "/:id/complete",
  requirePermission("appointment.exam"),
  completeDashboardAppointmentHandler,
);
router.patch(
  "/:id/no-show",
  requirePermission("appointment.front_desk"),
  noShowDashboardAppointmentHandler,
);
router.patch(
  "/:id/reschedule",
  requirePermission("appointment.front_desk"),
  validate(rescheduleAppointmentSchema),
  rescheduleDashboardAppointmentHandler,
);
router.patch(
  "/:id/patient-info",
  requirePermission("appointment.front_desk"),
  validate(updateAppointmentPatientInfoSchema),
  updateDashboardAppointmentPatientInfoHandler,
);
router.patch(
  "/:id/cancel",
  requirePermission("appointment.cancel"),
  validate(cancelAppointmentSchema),
  cancelDashboardAppointmentHandler,
);

export default router;

import { Router } from "express";
import {
  deleteDoctorTimeSlotHandler,
  generateDoctorTimeSlotsHandler,
  getDoctorTimeSlotHandler,
  listDoctorTimeSlotsHandler,
  lockDoctorTimeSlotHandler,
  reconcileDoctorTimeSlotsHandler,
  unlockDoctorTimeSlotHandler,
  updateDoctorTimeSlotStatusHandler,
} from "../controllers/doctorTimeSlot.controller.js";
import { authDashboard, requireRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  generateDoctorTimeSlotsSchema,
  lockDoctorTimeSlotSchema,
  updateDoctorTimeSlotStatusSchema,
} from "../validations/doctorTimeSlot.validation.js";

const router = Router();

router.use(authDashboard);

router.get(
  "/",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  listDoctorTimeSlotsHandler,
);
router.post(
  "/generate",
  requireRole("ADMIN", "STAFF"),
  validate(generateDoctorTimeSlotsSchema),
  generateDoctorTimeSlotsHandler,
);
router.post(
  "/reconcile",
  requireRole("ADMIN"),
  reconcileDoctorTimeSlotsHandler,
);
router.get(
  "/:id",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  getDoctorTimeSlotHandler,
);
router.patch(
  "/:id/status",
  requireRole("ADMIN", "STAFF"),
  validate(updateDoctorTimeSlotStatusSchema),
  updateDoctorTimeSlotStatusHandler,
);
router.patch(
  "/:id/lock",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  validate(lockDoctorTimeSlotSchema),
  lockDoctorTimeSlotHandler,
);
router.patch(
  "/:id/unlock",
  requireRole("ADMIN", "STAFF", "DOCTOR"),
  unlockDoctorTimeSlotHandler,
);
router.delete(
  "/:id",
  requireRole("ADMIN", "STAFF"),
  deleteDoctorTimeSlotHandler,
);

export default router;

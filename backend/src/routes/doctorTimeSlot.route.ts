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
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
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
  requirePermission("schedule.view"),
  listDoctorTimeSlotsHandler,
);
router.post(
  "/generate",
  requirePermission("schedule.manage"),
  validate(generateDoctorTimeSlotsSchema),
  generateDoctorTimeSlotsHandler,
);
router.post(
  "/reconcile",
  requirePermission("schedule.reconcile"),
  reconcileDoctorTimeSlotsHandler,
);
router.get(
  "/:id",
  requirePermission("schedule.view"),
  getDoctorTimeSlotHandler,
);
router.patch(
  "/:id/status",
  requirePermission("schedule.manage"),
  validate(updateDoctorTimeSlotStatusSchema),
  updateDoctorTimeSlotStatusHandler,
);
router.patch(
  "/:id/lock",
  requirePermission("schedule.lock"),
  validate(lockDoctorTimeSlotSchema),
  lockDoctorTimeSlotHandler,
);
router.patch(
  "/:id/unlock",
  requirePermission("schedule.lock"),
  unlockDoctorTimeSlotHandler,
);
router.delete(
  "/:id",
  requirePermission("schedule.manage"),
  deleteDoctorTimeSlotHandler,
);

export default router;

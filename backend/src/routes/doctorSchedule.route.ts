import { Router } from "express";
import {
  createDoctorScheduleHandler,
  deleteDoctorScheduleHandler,
  getDoctorScheduleHandler,
  listDoctorSchedulesHandler,
  updateDoctorScheduleHandler,
} from "../controllers/doctorSchedule.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createDoctorScheduleSchema,
  updateDoctorScheduleSchema,
} from "../validations/doctorSchedule.validation.js";

const router = Router();

router.use(authDashboard);

router.get(
  "/",
  requirePermission("schedule.view"),
  listDoctorSchedulesHandler,
);
router.get(
  "/:id",
  requirePermission("schedule.view"),
  getDoctorScheduleHandler,
);
router.post(
  "/",
  requirePermission("schedule.manage"),
  validate(createDoctorScheduleSchema),
  createDoctorScheduleHandler,
);
router.patch(
  "/:id",
  requirePermission("schedule.manage"),
  validate(updateDoctorScheduleSchema),
  updateDoctorScheduleHandler,
);
router.delete(
  "/:id",
  requirePermission("schedule.manage"),
  deleteDoctorScheduleHandler,
);

export default router;

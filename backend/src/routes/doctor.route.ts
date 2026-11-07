import { Router } from "express";
import {
  createDoctorHandler,
  deleteDoctorHandler,
  getDoctorHandler,
  listDoctorsHandler,
  updateDoctorAvailabilityHandler,
  updateDoctorHandler,
} from "../controllers/doctor.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createDoctorProfileSchema,
  updateDoctorAvailabilitySchema,
  updateDoctorProfileSchema,
} from "../validations/doctor.validation.js";

const router = Router();

router.use(authDashboard);

router.get("/", requirePermission("catalog.view"), listDoctorsHandler);
router.get("/:id", requirePermission("catalog.view"), getDoctorHandler);
router.post(
  "/",
  requirePermission("catalog.manage"),
  validate(createDoctorProfileSchema),
  createDoctorHandler,
);
router.patch(
  "/:id",
  requirePermission("catalog.manage"),
  validate(updateDoctorProfileSchema),
  updateDoctorHandler,
);
router.patch(
  "/:id/availability",
  requirePermission("catalog.manage"),
  validate(updateDoctorAvailabilitySchema),
  updateDoctorAvailabilityHandler,
);
router.delete("/:id", requirePermission("catalog.delete"), deleteDoctorHandler);

export default router;

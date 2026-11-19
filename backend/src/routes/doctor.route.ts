import { Router } from "express";
import {
  approveProfileHandler,
  createDoctorHandler,
  discardMyProfileDraftHandler,
  getMyProfileContentHandler,
  listPendingProfilesHandler,
  rejectProfileHandler,
  saveMyProfileDraftHandler,
  deleteDoctorHandler,
  getDoctorHandler,
  listDoctorsHandler,
  updateDoctorAvailabilityHandler,
  updateDoctorHandler,
} from "../controllers/doctor.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { doctorProfileDraftSchema } from "../validations/catalogContent.validation.js";
import {
  createDoctorProfileSchema,
  updateDoctorAvailabilitySchema,
  updateDoctorProfileSchema,
} from "../validations/doctor.validation.js";

const router = Router();

router.use(authDashboard);

router.get("/", requirePermission("catalog.view"), listDoctorsHandler);
// Bác sĩ tự soạn phần giới thiệu công khai (bản nháp chờ duyệt); đặt trước "/:id" để "me" không bị coi là mã hồ sơ.
router.get("/me/profile", requirePermission("profile.request"), getMyProfileContentHandler);
router.put("/me/profile", requirePermission("profile.request"), validate(doctorProfileDraftSchema), saveMyProfileDraftHandler);
router.delete("/me/profile", requirePermission("profile.request"), discardMyProfileDraftHandler);
router.get("/profile-reviews", requirePermission("profile.review"), listPendingProfilesHandler);
router.post("/:id/profile/approve", requirePermission("profile.review"), approveProfileHandler);
router.post("/:id/profile/reject", requirePermission("profile.review"), rejectProfileHandler);
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

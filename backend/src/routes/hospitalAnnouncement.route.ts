import { Router } from "express";
import {
  cancelHospitalAnnouncementHandler,
  createHospitalAnnouncementHandler,
  listHospitalAnnouncementsHandler,
} from "../controllers/hospitalAnnouncement.controller.js";
import { authDashboard, requireRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createHospitalAnnouncementSchema } from "../validations/hospitalAnnouncement.validation.js";

const router = Router();

router.use(authDashboard, requireRole("ADMIN", "STAFF"));
router.get("/", listHospitalAnnouncementsHandler);
router.post(
  "/",
  validate(createHospitalAnnouncementSchema),
  createHospitalAnnouncementHandler,
);
router.patch("/:campaignId/cancel", cancelHospitalAnnouncementHandler);

export default router;

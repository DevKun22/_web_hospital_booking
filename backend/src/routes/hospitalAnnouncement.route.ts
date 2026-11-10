import { Router } from "express";
import {
  cancelHospitalAnnouncementHandler,
  createHospitalAnnouncementHandler,
  listHospitalAnnouncementsHandler,
} from "../controllers/hospitalAnnouncement.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createHospitalAnnouncementSchema } from "../validations/hospitalAnnouncement.validation.js";

const router = Router();

router.use(authDashboard, requirePermission("notification.broadcast"));
router.get("/", listHospitalAnnouncementsHandler);
router.post(
  "/",
  validate(createHospitalAnnouncementSchema),
  createHospitalAnnouncementHandler,
);
router.patch("/:campaignId/cancel", cancelHospitalAnnouncementHandler);

export default router;

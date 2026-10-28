import { Router } from "express";
import {
  getPatientUnreadNotificationCountHandler,
  getPatientNotificationPreferencesHandler,
  listPatientNotificationsHandler,
  markAllPatientNotificationsReadHandler,
  markPatientNotificationReadHandler,
  updatePatientNotificationPreferencesHandler,
} from "../controllers/patientNotification.controller.js";
import { authPatient } from "../middlewares/patientAuth.middleware.js";

const router = Router();
router.use(authPatient);

router.get("/", listPatientNotificationsHandler);
router.get("/unread-count", getPatientUnreadNotificationCountHandler);
router.get("/preferences", getPatientNotificationPreferencesHandler);
router.patch("/preferences", updatePatientNotificationPreferencesHandler);
router.patch("/read-all", markAllPatientNotificationsReadHandler);
router.patch("/:id/read", markPatientNotificationReadHandler);

export default router;

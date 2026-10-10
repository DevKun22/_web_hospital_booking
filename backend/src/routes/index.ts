import { Router } from "express";
import appointmentRouter from "./appointment.route.js";
import authOtpRouter from "./authOtp.route.js";
import { dashboardBannerRouter, publicBannerRouter } from "./banner.route.js";
import chatbotRouter from "./chatbot.route.js";
import {
  dashboardConsultationRequestRouter,
  publicConsultationRequestRouter,
} from "./consultationRequest.route.js";
import departmentRouter from "./department.route.js";
import dashboardAppointmentRouter from "./dashboardAppointment.route.js";
import dashboardAuthRouter from "./dashboardAuth.route.js";
import dashboardChatbotRouter from "./dashboardChatbot.route.js";
import dashboardChatbotFaqRouter from "./dashboardChatbotFaq.route.js";
import dashboardStatisticsRouter from "./dashboardStatistics.route.js";
import dashboardReviewRouter from "./dashboardReview.route.js";
import dashboardUserRouter from "./dashboardUser.route.js";
import doctorRouter from "./doctor.route.js";
import doctorScheduleRouter from "./doctorSchedule.route.js";
import doctorTimeSlotRouter from "./doctorTimeSlot.route.js";
import scheduleChangeRequestRouter from "./scheduleChangeRequest.route.js";
import invoiceRouter from "./invoice.route.js";
import medicalRecordRouter from "./medicalRecord.route.js";
import packageRouter from "./package.route.js";
import paymentRouter from "./payment.route.js";
import prescriptionRouter from "./prescription.route.js";
import publicDepartmentRouter from "./publicDepartment.route.js";
import publicDoctorRouter from "./publicDoctor.route.js";
import { dashboardFAQRouter, publicFAQRouter } from "./publicFAQ.route.js";
import publicPackageRouter from "./publicPackage.route.js";
import searchRouter from "./search.route.js";
import {
  dashboardSiteSettingsRouter,
  publicSiteSettingsRouter,
} from "./siteSettings.route.js";
import uploadRouter from "./upload.route.js";
import v1Router from "./v1.route.js";

const router = Router();

router.use("/v1", v1Router);

router.use("/otp", authOtpRouter);
router.use("/chatbot", chatbotRouter);
router.use("/auth/dashboard", dashboardAuthRouter);
router.use("/appointments", appointmentRouter);
router.use("/dashboard/appointments", dashboardAppointmentRouter);
router.use("/dashboard/chatbot", dashboardChatbotRouter);
router.use("/dashboard/chatbot/faqs", dashboardChatbotFaqRouter);
router.use("/dashboard/consultation-requests", dashboardConsultationRequestRouter);
router.use("/dashboard/banners", dashboardBannerRouter);
router.use("/dashboard/faqs", dashboardFAQRouter);
router.use("/dashboard/site-settings", dashboardSiteSettingsRouter);
router.use("/dashboard/statistics", dashboardStatisticsRouter);
router.use("/dashboard/reviews", dashboardReviewRouter);
router.use("/dashboard/users", dashboardUserRouter);
router.use("/dashboard/departments", departmentRouter);
router.use("/dashboard/doctors", doctorRouter);
router.use("/dashboard/doctor-schedules", doctorScheduleRouter);
router.use("/dashboard/doctor-time-slots", doctorTimeSlotRouter);
router.use("/dashboard/schedule-change-requests", scheduleChangeRequestRouter);
router.use("/dashboard/invoices", invoiceRouter);
router.use("/dashboard/medical-records", medicalRecordRouter);
router.use("/dashboard/packages", packageRouter);
router.use("/dashboard/prescriptions", prescriptionRouter);
router.use("/departments", publicDepartmentRouter);
router.use("/banners", publicBannerRouter);
router.use("/doctors", publicDoctorRouter);
router.use("/faqs", publicFAQRouter);
router.use("/packages", publicPackageRouter);
router.use("/site-settings", publicSiteSettingsRouter);
router.use("/consultation-requests", publicConsultationRequestRouter);
router.use("/payments", paymentRouter);
router.use("/uploads", uploadRouter);
router.use("/search", searchRouter);

export default router;

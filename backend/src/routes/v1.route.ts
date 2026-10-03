import { Router } from "express";
import { patientCapabilitiesHandler } from "../controllers/patientPortalV1.controller.js";
import { publicBannerRouter } from "./banner.route.js";
import chatbotRouter from "./chatbot.route.js";
import appointmentRouter from "./appointment.route.js";
import patientAuthRouter from "./patientAuthV1.route.js";
import patientPortalRouter from "./patientPortalV1.route.js";
import publicDepartmentRouter from "./publicDepartment.route.js";
import publicDoctorRouter from "./publicDoctor.route.js";
import { publicFAQRouter } from "./publicFAQ.route.js";
import publicPackageRouter from "./publicPackage.route.js";
import { publicSiteSettingsRouter } from "./siteSettings.route.js";

const router = Router();

router.get("/capabilities", patientCapabilitiesHandler);
router.use("/auth", patientAuthRouter);
router.use("/me", patientPortalRouter);

// Additive aliases for shared public content. The legacy `/api/*` routes stay
// mounted for the web client while mobile can use one versioned base URL.
router.use("/banners", publicBannerRouter);
router.use("/departments", publicDepartmentRouter);
router.use("/doctors", publicDoctorRouter);
router.use("/packages", publicPackageRouter);
router.use("/faqs", publicFAQRouter);
router.use("/site-settings", publicSiteSettingsRouter);
router.use("/chatbot", chatbotRouter);
router.use("/appointments", appointmentRouter);

export default router;

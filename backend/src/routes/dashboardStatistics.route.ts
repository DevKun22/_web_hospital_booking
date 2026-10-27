import { Router } from "express";
import {
  getDashboardAppointmentStatisticsHandler,
  getDashboardDepartmentStatisticsHandler,
  getDashboardDoctorStatisticsHandler,
  getDashboardRevenueStatisticsHandler,
  getDashboardStatisticsOverviewHandler,
  getDashboardStatisticsWorkspaceHandler,
  getDoctorWorkspaceHandler,
} from "../controllers/dashboardStatistics.controller.js";
import { authDashboard, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authDashboard);
router.get(
  "/doctor-workspace",
  requireRole("DOCTOR"),
  getDoctorWorkspaceHandler,
);
router.use(requireRole("ADMIN", "STAFF"));

router.get("/overview", getDashboardStatisticsOverviewHandler);
router.get("/workspace", getDashboardStatisticsWorkspaceHandler);
router.get("/appointments", getDashboardAppointmentStatisticsHandler);
router.get("/revenue", getDashboardRevenueStatisticsHandler);
router.get("/doctors", getDashboardDoctorStatisticsHandler);
router.get("/departments", getDashboardDepartmentStatisticsHandler);

export default router;

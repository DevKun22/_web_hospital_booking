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
import { exportRevenueHandler } from "../controllers/dataExport.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authDashboard);
router.get(
  "/doctor-workspace",
  requirePermission("stats.doctor"),
  getDoctorWorkspaceHandler,
);
router.use(requirePermission("stats.view"));

router.get("/overview", getDashboardStatisticsOverviewHandler);
router.get("/workspace", getDashboardStatisticsWorkspaceHandler);
router.get("/appointments", getDashboardAppointmentStatisticsHandler);
router.get("/revenue", getDashboardRevenueStatisticsHandler);
router.get("/revenue/export", exportRevenueHandler);
router.get("/doctors", getDashboardDoctorStatisticsHandler);
router.get("/departments", getDashboardDepartmentStatisticsHandler);

export default router;

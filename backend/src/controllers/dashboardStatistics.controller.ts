import type { Request, Response } from "express";
import DashboardStatisticsService from "../services/dashboardStatistics.service.js";
import { AppError } from "../utils/appError.js";
import type { Role } from "../../generated/prisma/enums.js";
import { getVietnamNowParts } from "../utils/time.js";
import { parseStringQuery } from "../shared/http/requestParsers.js";

const parseDateQuery = (value: unknown, endOfDay = false) => {
  if (typeof value !== "string") return undefined;

  const date = new Date(
    endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getRangeQuery = (req: Request) => ({
  from: parseDateQuery(req.query.from || req.query.dateFrom),
  to: parseDateQuery(req.query.to || req.query.dateTo, true),
});

const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role) {
    throw new AppError("Chưa đăng nhập", 401);
  }

  return { userId: req.user.userId, role: req.user.role as Role };
};

export const getDoctorWorkspaceHandler = async (
  req: Request,
  res: Response,
) => {
  const date = parseStringQuery(req.query.date) ?? getVietnamNowParts().date;
  const data = await DashboardStatisticsService.getDoctorWorkspace(
    date,
    getActor(req),
  );

  return res.json({ success: true, data });
};

export const getDashboardStatisticsWorkspaceHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await DashboardStatisticsService.getWorkspace(
    getRangeQuery(req),
  );

  return res.json({ success: true, data });
};

export const getDashboardStatisticsOverviewHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await DashboardStatisticsService.getOverview(
    getRangeQuery(req),
  );

  return res.json({ success: true, data });
};

export const getDashboardAppointmentStatisticsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await DashboardStatisticsService.getAppointments(
    getRangeQuery(req),
  );

  return res.json({ success: true, data });
};

export const getDashboardRevenueStatisticsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await DashboardStatisticsService.getRevenue(
    getRangeQuery(req),
  );

  return res.json({ success: true, data });
};

export const getDashboardDoctorStatisticsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await DashboardStatisticsService.getDoctors(
    getRangeQuery(req),
  );

  return res.json({ success: true, data });
};

export const getDashboardDepartmentStatisticsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await DashboardStatisticsService.getDepartments(
    getRangeQuery(req),
  );

  return res.json({ success: true, data });
};

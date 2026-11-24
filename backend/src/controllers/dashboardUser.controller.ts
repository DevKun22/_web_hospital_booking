import type { Request, Response } from "express";
import { Role } from "../../generated/prisma/enums.js";
import DashboardUserService from "../services/dashboardUser.service.js";
import { AppError } from "../utils/appError.js";
import { getClientIp } from "../utils/clientIp.js";
import { getRequiredPathParam, parseEnumQuery, parseStringQuery } from "../shared/http/requestParsers.js";

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};


const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role) {
    throw new AppError("Chưa đăng nhập", 401);
  }

  return { userId: req.user.userId, role: req.user.role as Role };
};

export const listDashboardUsersHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DashboardUserService.list({
    search:
      parseStringQuery(req.query.search),
    role:
      parseEnumQuery(req.query.role, Role, "role"),
    isActive: parseBooleanQuery(req.query.isActive),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({
    success: true,
    data: result,
  });
};

export const getDashboardUserHandler = async (
  req: Request,
  res: Response,
) => {
  const id = getRequiredPathParam(req.params.id);
  const user = await DashboardUserService.getById(id);

  return res.json({
    success: true,
    data: user,
  });
};

export const createDashboardUserHandler = async (
  req: Request,
  res: Response,
) => {
  const user = await DashboardUserService.create(
    req.body,
    getActor(req),
    getClientIp(req),
  );

  return res.status(201).json({
    success: true,
    message: "Tạo tài khoản dashboard thành công",
    data: user,
  });
};

export const updateDashboardUserHandler = async (
  req: Request,
  res: Response,
) => {
  const id = getRequiredPathParam(req.params.id);
  const user = await DashboardUserService.update(
    id,
    req.body,
    getActor(req),
    getClientIp(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật tài khoản dashboard thành công",
    data: user,
  });
};

export const updateDashboardUserStatusHandler = async (
  req: Request,
  res: Response,
) => {
  const id = getRequiredPathParam(req.params.id);
  const user = await DashboardUserService.updateStatus(
    id,
    req.body.isActive,
    getActor(req),
    getClientIp(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật trạng thái tài khoản thành công",
    data: user,
  });
};

export const updateDashboardUserPasswordHandler = async (
  req: Request,
  res: Response,
) => {
  const id = getRequiredPathParam(req.params.id);
  const user = await DashboardUserService.updatePassword(
    id,
    req.body.password,
    getActor(req),
    getClientIp(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật mật khẩu thành công",
    data: user,
  });
};

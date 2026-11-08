import type { Request, Response, NextFunction } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import DashboardUserService from "../services/dashboardUser.service.js";
import { AppError } from "../utils/appError.js";
import { getClientIp } from "../utils/clientIp.js";

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

const getParam = (value: string | string[] | undefined) => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError("Thiếu id", 400);
  }

  return param;
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
  next: NextFunction,
) => {
  try {
    const result = await DashboardUserService.list({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      role:
        typeof req.query.role === "string"
          ? (req.query.role as Role)
          : undefined,
      isActive: parseBooleanQuery(req.query.isActive),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = getParam(req.params.id);
    const user = await DashboardUserService.getById(id);

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const createDashboardUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

export const updateDashboardUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = getParam(req.params.id);
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
  } catch (error) {
    next(error);
  }
};

export const updateDashboardUserStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = getParam(req.params.id);
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
  } catch (error) {
    next(error);
  }
};

export const updateDashboardUserPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = getParam(req.params.id);
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
  } catch (error) {
    next(error);
  }
};

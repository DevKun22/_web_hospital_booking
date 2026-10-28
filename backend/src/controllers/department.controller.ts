import type { Request, Response, NextFunction } from "express";
import DepartmentService from "../services/department.service.js";
import { AppError } from "../utils/appError.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";

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

export const listDepartmentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await DepartmentService.list({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
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

export const getDepartmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await DepartmentService.getById(getParam(req.params.id));

    return res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

export const createDepartmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await DepartmentService.create(req.body);
    PublicBootstrapService.invalidate();

    return res.status(201).json({
      success: true,
      message: "Tạo chuyên khoa thành công",
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDepartmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await DepartmentService.update(
      getParam(req.params.id),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật chuyên khoa thành công",
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDepartmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await DepartmentService.delete(getParam(req.params.id));
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Xóa chuyên khoa thành công",
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

import type { Request, Response } from "express";
import DepartmentService from "../services/department.service.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

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


export const listDepartmentsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DepartmentService.list({
    search:
      parseStringQuery(req.query.search),
    isActive: parseBooleanQuery(req.query.isActive),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({
    success: true,
    data: result,
  });
};

export const getDepartmentHandler = async (
  req: Request,
  res: Response,
) => {
  const department = await DepartmentService.getById(getRequiredPathParam(req.params.id));

  return res.json({
    success: true,
    data: department,
  });
};

export const createDepartmentHandler = async (
  req: Request,
  res: Response,
) => {
  const department = await DepartmentService.create(req.body);
  PublicBootstrapService.invalidate();

  return res.status(201).json({
    success: true,
    message: "Tạo chuyên khoa thành công",
    data: department,
  });
};

export const updateDepartmentHandler = async (
  req: Request,
  res: Response,
) => {
  const department = await DepartmentService.update(
    getRequiredPathParam(req.params.id),
    req.body,
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật chuyên khoa thành công",
    data: department,
  });
};

export const deleteDepartmentHandler = async (
  req: Request,
  res: Response,
) => {
  const department = await DepartmentService.delete(getRequiredPathParam(req.params.id));
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Xóa chuyên khoa thành công",
    data: department,
  });
};

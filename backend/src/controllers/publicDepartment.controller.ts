import type { Request, Response, NextFunction } from "express";
import PublicDepartmentService from "../services/publicDepartment.service.js";
import { AppError } from "../utils/appError.js";

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const getParam = (value: string | string[] | undefined, name: string) => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

export const listPublicDepartmentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departments = await PublicDepartmentService.list({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
    });

    return res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicDepartmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await PublicDepartmentService.getBySlug(
      getParam(req.params.slug, "slug"),
    );

    return res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

export const listPublicDepartmentCatalogHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PublicDepartmentService.listCatalog({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      available: req.query.available === "true" ? true : undefined,
      sort: req.query.sort === "NAME_ASC" ? "NAME_ASC" : "POPULAR_DESC",
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPublicDepartmentOverviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PublicDepartmentService.getOverviewBySlug(
      getParam(req.params.slug, "slug"),
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

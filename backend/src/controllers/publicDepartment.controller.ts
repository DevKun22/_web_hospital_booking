import type { Request, Response } from "express";
import PublicDepartmentService from "../services/publicDepartment.service.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};


export const listPublicDepartmentsHandler = async (
  req: Request,
  res: Response,
) => {
  const departments = await PublicDepartmentService.list({
    search:
      parseStringQuery(req.query.search),
  });

  return res.json({
    success: true,
    data: departments,
  });
};

export const getPublicDepartmentHandler = async (
  req: Request,
  res: Response,
) => {
  const department = await PublicDepartmentService.getBySlug(
    getRequiredPathParam(req.params.slug, "slug"),
  );

  return res.json({
    success: true,
    data: department,
  });
};

export const listPublicDepartmentCatalogHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PublicDepartmentService.listCatalog({
    search:
      parseStringQuery(req.query.search),
    available: req.query.available === "true" ? true : undefined,
    sort: req.query.sort === "NAME_ASC" ? "NAME_ASC" : "POPULAR_DESC",
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({ success: true, data: result });
};

export const getPublicDepartmentOverviewHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PublicDepartmentService.getOverviewBySlug(
    getRequiredPathParam(req.params.slug, "slug"),
  );

  return res.json({ success: true, data: result });
};

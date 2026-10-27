import type { Request, Response, NextFunction } from "express";
import PublicDoctorService from "../services/publicDoctor.service.js";
import { AppError } from "../utils/appError.js";

const getParam = (value: string | string[] | undefined, name: string) => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export const listPublicDoctorsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctors = await PublicDoctorService.list({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      departmentSlug:
        typeof req.query.departmentSlug === "string"
          ? req.query.departmentSlug
          : undefined,
      departmentId:
        typeof req.query.departmentId === "string"
          ? req.query.departmentId
          : undefined,
      includeHighlights: req.query.includeHighlights === "true",
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};

export const listPublicDoctorCatalogHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PublicDoctorService.listCatalog({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      departmentId:
        typeof req.query.departmentId === "string"
          ? req.query.departmentId
          : undefined,
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPublicDoctorHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctor = await PublicDoctorService.getByIdentifier(
      getParam(req.params.id, "mã bác sĩ"),
    );

    return res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

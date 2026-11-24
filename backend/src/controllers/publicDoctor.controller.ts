import type { Request, Response } from "express";
import PublicDoctorService from "../services/publicDoctor.service.js";
import { AppError } from "../utils/appError.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";


const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export const listPublicDoctorsHandler = async (
  req: Request,
  res: Response,
) => {
  const doctors = await PublicDoctorService.list({
    search:
      parseStringQuery(req.query.search),
    departmentSlug:
      parseStringQuery(req.query.departmentSlug),
    departmentId:
      parseStringQuery(req.query.departmentId),
    includeHighlights: req.query.includeHighlights === "true",
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({
    success: true,
    data: doctors,
  });
};

export const listPublicDoctorCatalogHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PublicDoctorService.listCatalog({
    search:
      parseStringQuery(req.query.search),
    departmentId:
      parseStringQuery(req.query.departmentId),
    minExperience: parseNumberQuery(req.query.minExperience),
    availableToday: req.query.availableToday === "true",
    sort:
      req.query.sort === "EXPERIENCE_DESC" || req.query.sort === "NAME_ASC"
        ? req.query.sort
        : undefined,
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({ success: true, data: result });
};

export const getPublicDoctorHandler = async (
  req: Request,
  res: Response,
) => {
  const doctor = await PublicDoctorService.getByIdentifier(
    getRequiredPathParam(req.params.id, "mã bác sĩ"),
  );

  return res.json({
    success: true,
    data: doctor,
  });
};

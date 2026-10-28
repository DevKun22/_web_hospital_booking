import type { NextFunction, Request, Response } from "express";
import PatientDependentService from "../services/patientDependent.service.js";
import { AppError } from "../utils/appError.js";

const ownerId = (req: Request) => {
  if (!req.patient?.userId) throw new AppError("Vui lòng đăng nhập", 401);
  return req.patient.userId;
};

const dependentId = (req: Request) => {
  const raw = req.params.id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw new AppError("Thiếu id hồ sơ người thân", 400);
  return value;
};

export const listPatientDependentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.json({
      success: true,
      data: await PatientDependentService.list(ownerId(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const createPatientDependentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.status(201).json({
      success: true,
      data: await PatientDependentService.create(ownerId(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const updatePatientDependentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.json({
      success: true,
      data: await PatientDependentService.update(
        ownerId(req),
        dependentId(req),
        req.body,
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const archivePatientDependentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.json({
      success: true,
      data: await PatientDependentService.archive(ownerId(req), dependentId(req)),
    });
  } catch (error) {
    next(error);
  }
};

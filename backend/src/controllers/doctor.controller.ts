import type { Request, Response, NextFunction } from "express";
import DoctorService from "../services/doctor.service.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";
import {
  getRequiredPathParam as getParam,
  parseBooleanQuery,
  parseNumberQuery,
} from "../shared/http/requestParsers.js";

export const listDoctorsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await DoctorService.list({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      departmentId:
        typeof req.query.departmentId === "string"
          ? req.query.departmentId
          : undefined,
      isAvailable: parseBooleanQuery(req.query.isAvailable),
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

export const getDoctorHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctor = await DoctorService.getById(getParam(req.params.id));

    return res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

export const createDoctorHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctor = await DoctorService.create(req.body);
    PublicBootstrapService.invalidate();

    return res.status(201).json({
      success: true,
      message: "Tạo hồ sơ bác sĩ thành công",
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDoctorHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctor = await DoctorService.update(
      getParam(req.params.id),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật hồ sơ bác sĩ thành công",
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDoctorAvailabilityHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctor = await DoctorService.updateAvailability(
      getParam(req.params.id),
      req.body.isAvailable,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật trạng thái bác sĩ thành công",
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctorHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const doctor = await DoctorService.delete(getParam(req.params.id));
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Xóa hồ sơ bác sĩ thành công",
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

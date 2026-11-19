import type { NextFunction, Request, Response } from "express";
import FacilityService from "../services/facility.service.js";
import { getRequiredPathParam as getParam } from "../shared/http/requestParsers.js";

export const listPublicFacilitiesHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await FacilityService.listPublic() });
  } catch (error) {
    next(error);
  }
};

export const listFacilitiesHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await FacilityService.list() });
  } catch (error) {
    next(error);
  }
};

export const createFacilityHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(201).json({ success: true, message: "Đã tạo cơ sở", data: await FacilityService.create(req.body) });
  } catch (error) {
    next(error);
  }
};

export const updateFacilityHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, message: "Đã cập nhật cơ sở", data: await FacilityService.update(getParam(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
};

export const deleteFacilityHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, message: "Đã xóa cơ sở", data: await FacilityService.delete(getParam(req.params.id)) });
  } catch (error) {
    next(error);
  }
};

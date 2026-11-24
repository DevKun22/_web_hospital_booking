import type { Request, Response } from "express";
import FacilityService from "../services/facility.service.js";
import { getRequiredPathParam as getParam } from "../shared/http/requestParsers.js";

export const listPublicFacilitiesHandler = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await FacilityService.listPublic() });
};

export const listFacilitiesHandler = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await FacilityService.list() });
};

export const createFacilityHandler = async (req: Request, res: Response) => {
  return res.status(201).json({ success: true, message: "Đã tạo cơ sở", data: await FacilityService.create(req.body) });
};

export const updateFacilityHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, message: "Đã cập nhật cơ sở", data: await FacilityService.update(getParam(req.params.id), req.body) });
};

export const deleteFacilityHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, message: "Đã xóa cơ sở", data: await FacilityService.delete(getParam(req.params.id)) });
};

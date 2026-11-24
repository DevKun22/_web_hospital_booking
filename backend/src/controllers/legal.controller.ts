import type { Request, Response } from "express";
import LegalService from "../services/legal.service.js";

export const getLegalHandler = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await LegalService.get() });
};

export const updateLegalHandler = async (req: Request, res: Response) => {
  const data = await LegalService.update(req.body);
  return res.json({ success: true, message: "Đã lưu điều khoản", data });
};

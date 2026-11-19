import type { NextFunction, Request, Response } from "express";
import LegalService from "../services/legal.service.js";

export const getLegalHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await LegalService.get() });
  } catch (error) {
    next(error);
  }
};

export const updateLegalHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await LegalService.update(req.body);
    return res.json({ success: true, message: "Đã lưu điều khoản", data });
  } catch (error) {
    next(error);
  }
};

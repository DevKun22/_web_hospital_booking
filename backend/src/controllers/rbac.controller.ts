import type { NextFunction, Request, Response } from "express";
import RbacService from "../services/rbac.service.js";
import { AppError } from "../utils/appError.js";

export const getRbacMatrixHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.json({ success: true, data: await RbacService.getMatrix() });
  } catch (error) {
    next(error);
  }
};

export const updateRbacMatrixHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user?.userId) throw new AppError("Chưa đăng nhập", 401);
    const data = await RbacService.updateMatrix(req.body.grants, req.user.userId);
    return res.json({ success: true, message: "Đã cập nhật phân quyền", data });
  } catch (error) {
    next(error);
  }
};

export const resetRbacMatrixHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await RbacService.resetMatrix();
    return res.json({ success: true, message: "Đã khôi phục phân quyền mặc định", data });
  } catch (error) {
    next(error);
  }
};

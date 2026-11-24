import type { Request, Response } from "express";
import RbacService from "../services/rbac.service.js";
import { AppError } from "../utils/appError.js";
import { getClientIp } from "../utils/clientIp.js";

export const getRbacMatrixHandler = async (
  _req: Request,
  res: Response,
) => {
  return res.json({ success: true, data: await RbacService.getMatrix() });
};

export const updateRbacMatrixHandler = async (
  req: Request,
  res: Response,
) => {
  if (!req.user?.userId) throw new AppError("Chưa đăng nhập", 401);
  const data = await RbacService.updateMatrix(
    req.body.grants,
    { userId: req.user.userId, role: req.user.role },
    getClientIp(req),
  );
  return res.json({ success: true, message: "Đã cập nhật phân quyền", data });
};

export const resetRbacMatrixHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await RbacService.resetMatrix(
    req.user ? { userId: req.user.userId, role: req.user.role } : undefined,
    getClientIp(req),
  );
  return res.json({ success: true, message: "Đã khôi phục phân quyền mặc định", data });
};

import type { NextFunction, Request, Response } from "express";
import PolicyService, { POLICY_LIMITS } from "../services/policy.service.js";

export const getPolicyHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.json({
      success: true,
      data: { policy: await PolicyService.get(), limits: POLICY_LIMITS },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePolicyHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const policy = await PolicyService.update(req.body);
    return res.json({
      success: true,
      message: "Đã cập nhật chính sách",
      data: { policy, limits: POLICY_LIMITS },
    });
  } catch (error) {
    next(error);
  }
};

export const resetPolicyHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.json({
      success: true,
      message: "Đã khôi phục chính sách mặc định",
      data: { policy: await PolicyService.reset(), limits: POLICY_LIMITS },
    });
  } catch (error) {
    next(error);
  }
};

import type { NextFunction, Request, Response } from "express";
import PharmacyService from "../services/pharmacy.service.js";
import { AppError } from "../utils/appError.js";

const param = (value: string | string[] | undefined) => {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item) throw new AppError("Thiếu id", 400);
  return item;
};
const actorOf = (req: Request) => {
  if (!req.user?.userId || !req.user.role) throw new AppError("Chưa đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role };
};
const num = (value: unknown) => {
  if (typeof value !== "string" || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const bool = (value: unknown) => (value === "true" ? true : value === "false" ? false : undefined);
const str = (value: unknown) => (typeof value === "string" ? value : undefined);

type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap =
  (handler: Handler) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

export const listMedicinesHandler = wrap(async (req, res) =>
  res.json({
    success: true,
    data: await PharmacyService.listMedicines({
      q: str(req.query.q),
      lowStock: bool(req.query.lowStock),
      isActive: bool(req.query.isActive),
      page: num(req.query.page),
      limit: num(req.query.limit),
    }),
  }),
);

export const getMedicineHandler = wrap(async (req, res) =>
  res.json({ success: true, data: await PharmacyService.getMedicine(param(req.params.id)) }),
);

export const createMedicineHandler = wrap(async (req, res) =>
  res.status(201).json({
    success: true,
    message: "Đã thêm thuốc",
    data: await PharmacyService.createMedicine(req.body),
  }),
);

export const updateMedicineHandler = wrap(async (req, res) =>
  res.json({
    success: true,
    message: "Đã cập nhật thuốc",
    data: await PharmacyService.updateMedicine(param(req.params.id), req.body),
  }),
);

export const listMovementsHandler = wrap(async (req, res) =>
  res.json({
    success: true,
    data: await PharmacyService.listMovements(param(req.params.id), {
      page: num(req.query.page),
      limit: num(req.query.limit),
    }),
  }),
);

export const receiveStockHandler = wrap(async (req, res) =>
  res.status(201).json({
    success: true,
    message: "Đã nhập kho",
    data: await PharmacyService.receive(
      param(req.params.id),
      req.body.quantity,
      req.body.reason,
      actorOf(req),
    ),
  }),
);

export const adjustStockHandler = wrap(async (req, res) =>
  res.status(201).json({
    success: true,
    message: "Đã điều chỉnh tồn kho",
    data: await PharmacyService.adjust(
      param(req.params.id),
      req.body.delta,
      req.body.reason,
      actorOf(req),
    ),
  }),
);

export const listPrescriptionsHandler = wrap(async (req, res) => {
  const status = str(req.query.dispenseStatus);
  res.json({
    success: true,
    data: await PharmacyService.listPrescriptions({
      dispenseStatus:
        status === "DISPENSED" || status === "NOT_DISPENSED" ? status : undefined,
      q: str(req.query.q),
      page: num(req.query.page),
      limit: num(req.query.limit),
    }),
  });
});

export const getPrescriptionHandler = wrap(async (req, res) =>
  res.json({
    success: true,
    data: await PharmacyService.getPrescription(param(req.params.id)),
  }),
);

export const dispensePrescriptionHandler = wrap(async (req, res) =>
  res.json({
    success: true,
    message: "Đã cấp thuốc",
    data: await PharmacyService.dispense(param(req.params.id), req.body, actorOf(req)),
  }),
);

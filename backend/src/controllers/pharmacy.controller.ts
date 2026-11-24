import type { Request, Response } from "express";
import PharmacyService from "../services/pharmacy.service.js";
import PharmacyDispenseService from "../services/pharmacyDispense.service.js";
import PharmacyImportService, { type ImportKind } from "../services/pharmacyImport.service.js";
import { getClientIp } from "../utils/clientIp.js";
import { AppError } from "../utils/appError.js";
import {
  getRequiredPathParam,
  parseBooleanQuery,
  parseNumberQuery,
  parseStringQuery,
} from "../shared/http/requestParsers.js";

const actorOf = (req: Request) => {
  if (!req.user?.userId || !req.user.role) throw new AppError("Chưa đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role };
};


export const listMedicinesHandler = async (req: Request, res: Response) =>
  res.json({
    success: true,
    data: await PharmacyService.listMedicines({
      q: parseStringQuery(req.query.q),
      lowStock: parseBooleanQuery(req.query.lowStock),
      isActive: parseBooleanQuery(req.query.isActive),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    }),
  });

export const getMedicineHandler = async (req: Request, res: Response) =>
  res.json({ success: true, data: await PharmacyService.getMedicine(getRequiredPathParam(req.params.id)) });

export const createMedicineHandler = async (req: Request, res: Response) =>
  res.status(201).json({
    success: true,
    message: "Đã thêm thuốc",
    data: await PharmacyService.createMedicine(req.body),
  });

export const updateMedicineHandler = async (req: Request, res: Response) =>
  res.json({
    success: true,
    message: "Đã cập nhật thuốc",
    data: await PharmacyService.updateMedicine(getRequiredPathParam(req.params.id), req.body),
  });

export const listMovementsHandler = async (req: Request, res: Response) =>
  res.json({
    success: true,
    data: await PharmacyService.listMovements(getRequiredPathParam(req.params.id), {
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    }),
  });

export const receiveStockHandler = async (req: Request, res: Response) =>
  res.status(201).json({
    success: true,
    message: "Đã nhập kho",
    data: await PharmacyService.receive(
      getRequiredPathParam(req.params.id),
      req.body.quantity,
      req.body.reason,
      actorOf(req),
      { batchNumber: req.body.batchNumber, expiryDate: req.body.expiryDate },
    ),
  });

export const adjustStockHandler = async (req: Request, res: Response) =>
  res.status(201).json({
    success: true,
    message: "Đã điều chỉnh tồn kho",
    data: await PharmacyService.adjust(
      getRequiredPathParam(req.params.id),
      req.body.delta,
      req.body.reason,
      actorOf(req),
      req.body.batchId,
    ),
  });

export const listBatchesHandler = async (req: Request, res: Response) =>
  res.json({ success: true, data: await PharmacyService.listBatches(getRequiredPathParam(req.params.id)) });

export const expiryAlertsHandler = async (req: Request, res: Response) =>
  res.json({ success: true, data: await PharmacyService.expiryAlerts(parseNumberQuery(req.query.days)) });

export const listPrescriptionsHandler = async (req: Request, res: Response) => {
  const status = parseStringQuery(req.query.dispenseStatus);
  res.json({
    success: true,
    data: await PharmacyDispenseService.listPrescriptions({
      dispenseStatus:
        status === "DISPENSED" || status === "NOT_DISPENSED" ? status : undefined,
      q: parseStringQuery(req.query.q),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    }),
  });
};

export const getPrescriptionHandler = async (req: Request, res: Response) =>
  res.json({
    success: true,
    data: await PharmacyDispenseService.getPrescription(getRequiredPathParam(req.params.id)),
  });

export const dispensePrescriptionHandler = async (req: Request, res: Response) =>
  res.json({
    success: true,
    message: "Đã cấp thuốc",
    data: await PharmacyDispenseService.dispense(getRequiredPathParam(req.params.id), req.body, actorOf(req)),
  });

const importHandler = (kind: ImportKind) =>
  async (req: Request, res: Response) => {
    const apply = req.body.apply === true;
    const data = await PharmacyImportService.run(kind, req.body.csv, apply, actorOf(req), getClientIp(req));
    return res.json({
      success: true,
      message: data.applied ? "Đã nhập dữ liệu" : "Đã kiểm tra tệp",
      data,
    });
  };

export const importCatalogHandler = importHandler("catalog");
export const importReceiptsHandler = importHandler("receipts");

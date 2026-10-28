import type { NextFunction, Request, Response } from "express";
import PaymentService from "../services/payment.service.js";
import { AppError } from "../utils/appError.js";

const requirePatientId = (req: Request) => {
  if (!req.patient?.userId) throw new AppError("Vui lòng đăng nhập", 401);
  return req.patient.userId;
};

const param = (req: Request, name: string) => {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw new AppError(`Thiếu ${name}`, 400);
  return value;
};

const idempotencyKey = (req: Request) => {
  const value = req.get("Idempotency-Key")?.trim();
  if (!value) return undefined;
  if (value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new AppError(
      "Idempotency-Key không hợp lệ",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  }
  return value;
};

const toPatientPayment = <T extends Record<string, unknown>>(payment: T) => {
  const {
    activeKey: _activeKey,
    idempotencyKey: _idempotencyKey,
    rawResponse: _rawResponse,
    ...safePayment
  } = payment;
  return safePayment;
};

export const getPatientPaymentCapabilitiesHandler = (
  _req: Request,
  res: Response,
) => res.json({ success: true, data: PaymentService.getCapabilities() });

export const createPatientPaymentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await PaymentService.createForInvoice(
      param(req, "invoiceId"),
      req.body,
      requirePatientId(req),
      idempotencyKey(req),
    );
    return res.status(201).json({
      success: true,
      message: "Tạo giao dịch thanh toán thành công",
      data: toPatientPayment(data),
    });
  } catch (error) {
    next(error);
  }
};

export const getPatientPaymentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await PaymentService.getById(
      param(req, "paymentId"),
      requirePatientId(req),
    );
    return res.json({ success: true, data: toPatientPayment(data) });
  } catch (error) {
    next(error);
  }
};

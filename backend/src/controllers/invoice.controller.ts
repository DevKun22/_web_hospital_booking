import type { Request, Response } from "express";
import {
  InvoiceStatus,
  PaymentMethod,
} from "../../generated/prisma/enums.js";
import InvoiceService from "../services/invoice.service.js";
import InvoiceMedicineService from "../services/invoiceMedicine.service.js";
import InvoiceRefundService from "../services/invoiceRefund.service.js";
import { AppError } from "../utils/appError.js";
import { getClientIp } from "../utils/clientIp.js";
import { getRequiredPathParam, parseEnumQuery, parseStringQuery } from "../shared/http/requestParsers.js";

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};


const getActorId = (req: Request) => {
  if (!req.user?.userId) throw new AppError("Chưa đăng nhập", 401);
  return req.user.userId;
};

export const listInvoicesHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await InvoiceService.list({
    status:
      parseEnumQuery(req.query.status, InvoiceStatus, "status"),
    paymentMethod:
      parseEnumQuery(req.query.paymentMethod, PaymentMethod, "paymentMethod"),
    patientId:
      parseStringQuery(req.query.patientId),
    appointmentId:
      parseStringQuery(req.query.appointmentId),
    invoiceCode:
      parseStringQuery(req.query.invoiceCode),
    q: parseStringQuery(req.query.q),
    barcode:
      parseStringQuery(req.query.barcode),
    phone: parseStringQuery(req.query.phone),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({ success: true, data: result });
};

export const getInvoiceHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceService.getById(getRequiredPathParam(req.params.id));

  return res.json({ success: true, data: invoice });
};

export const createInvoiceForAppointmentHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceService.createForAppointment(
    getRequiredPathParam(req.params.appointmentId, "appointmentId"),
    req.body,
  );

  return res.status(201).json({
    success: true,
    message: "Tạo hóa đơn thành công",
    data: invoice,
  });
};

export const updateInvoiceHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceService.updateFinancials(
    getRequiredPathParam(req.params.id),
    req.body,
    { userId: getActorId(req), role: req.user!.role },
    getClientIp(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật hóa đơn thành công",
    data: invoice,
  });
};

export const paySupplementHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceMedicineService.paySupplement(
    getRequiredPathParam(req.params.id),
    getRequiredPathParam(req.params.supplementId, "supplementId"),
    req.body,
    getActorId(req),
  );

  return res.json({
    success: true,
    message: "Đã thu hóa đơn bổ sung tiền thuốc",
    data: invoice,
  });
};

export const payInvoiceHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceService.pay(
    getRequiredPathParam(req.params.id),
    req.body,
    getActorId(req),
  );

  return res.json({
    success: true,
    message: "Thanh toán hóa đơn thành công",
    data: invoice,
  });
};

export const cancelInvoiceHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceService.cancel(
    getRequiredPathParam(req.params.id),
    getActorId(req),
  );

  return res.json({
    success: true,
    message: "Hủy hóa đơn thành công",
    data: invoice,
  });
};

export const refundInvoiceHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceRefundService.refund(
    getRequiredPathParam(req.params.id),
    req.body,
    getActorId(req),
    { role: req.user!.role, ipAddress: getClientIp(req) },
  );

  return res.json({
    success: true,
    message: "Hoàn tiền hóa đơn thành công",
    data: invoice,
  });
};

export const refundInvoiceViaVnpayHandler = async (
  req: Request,
  res: Response,
) => {
  const invoice = await InvoiceRefundService.refundViaVnpay(
    getRequiredPathParam(req.params.id),
    req.body,
    getActorId(req),
    getClientIp(req),
    req.user!.role,
  );

  return res.json({
    success: true,
    message: "Đã gửi yêu cầu hoàn tiền tới VNPAY và ghi nhận vào hóa đơn",
    data: invoice,
  });
};

// Các dòng tiền thuốc đang chờ hoàn của hóa đơn đã thanh toán.
export const listRefundableMedicineHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await InvoiceMedicineService.listRefundableMedicine(getRequiredPathParam(req.params.id));
  return res.json({ success: true, data });
};

// Ghi nhận đã hoàn tiền thuốc một phần (tiền được hoàn ở cổng thanh toán hoặc tiền mặt).
export const recordMedicineRefundHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await InvoiceMedicineService.recordMedicineRefund(
    getRequiredPathParam(req.params.id),
    req.body,
    { userId: getActorId(req) as string, role: req.user!.role },
    getClientIp(req),
  );
  return res.json({ success: true, message: "Đã ghi nhận hoàn tiền thuốc", data });
};

import type { NextFunction, Request, Response } from "express";
import type { AppointmentStatus, InvoiceStatus } from "../../generated/prisma/enums.js";
import PatientPortalService from "../services/patientPortal.service.js";
import SecureMedicalFileService from "../services/secureMedicalFile.service.js";
import { AppError } from "../utils/appError.js";
import { parsePagination } from "../utils/pagination.js";

const appointmentStatuses = new Set<AppointmentStatus>([
  "PENDING_OTP", "PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN",
  "IN_PROGRESS", "COMPLETED", "RESCHEDULED", "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DOCTOR", "CANCELLED_BY_ADMIN", "NO_SHOW",
]);
const invoiceStatuses = new Set<InvoiceStatus>([
  "UNPAID", "PAID", "CANCELLED", "REFUNDED",
]);

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

const optionalEnumQuery = <T extends string>(
  value: unknown,
  allowed: Set<T>,
  field: string,
) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new AppError(`${field} không hợp lệ`, 400, "VALIDATION_ERROR");
  }
  return value as T;
};

export const getPatientProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.getProfile(requirePatientId(req)) });
  } catch (error) { next(error); }
};

export const updatePatientProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.updateProfile(requirePatientId(req), req.body) });
  } catch (error) { next(error); }
};

export const listPatientAppointmentsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await PatientPortalService.listAppointments(requirePatientId(req), {
      ...pagination,
      status: optionalEnumQuery(req.query.status, appointmentStatuses, "status"),
    });
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getPatientAppointmentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.getAppointment(requirePatientId(req), param(req, "id")) });
  } catch (error) { next(error); }
};

export const cancelPatientAppointmentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.cancelAppointment(requirePatientId(req), param(req, "id"), req.body.reason) });
  } catch (error) { next(error); }
};

export const listPatientMedicalRecordsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PatientPortalService.listMedicalRecords(requirePatientId(req), parsePagination(req.query));
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getPatientMedicalRecordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.getMedicalRecord(requirePatientId(req), param(req, "id")) });
  } catch (error) { next(error); }
};

export const downloadPatientMedicalFileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await PatientPortalService.getMedicalFileSource(
      requirePatientId(req),
      param(req, "id"),
      req.params.labResultId ? param(req, "labResultId") : undefined,
    );
    const file = await SecureMedicalFileService.fetch(source.url);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${source.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(file.buffer);
  } catch (error) { next(error); }
};

export const listPatientPrescriptionsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PatientPortalService.listPrescriptions(requirePatientId(req), parsePagination(req.query));
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getPatientPrescriptionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.getPrescription(requirePatientId(req), param(req, "id")) });
  } catch (error) { next(error); }
};

export const listPatientInvoicesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await PatientPortalService.listInvoices(requirePatientId(req), {
      ...pagination,
      status: optionalEnumQuery(req.query.status, invoiceStatuses, "status"),
    });
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getPatientInvoiceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await PatientPortalService.getInvoice(requirePatientId(req), param(req, "id")) });
  } catch (error) { next(error); }
};

export const patientCapabilitiesHandler = (_req: Request, res: Response) =>
  res.json({
    success: true,
    data: {
      apiVersion: "v1",
      payment: {
        enabled: false,
        reason: "PAYMENT_EXCLUDED_FROM_PATIENT_MVP",
        supportedProviders: [],
      },
      pushNotifications: { enabled: false },
    },
  });

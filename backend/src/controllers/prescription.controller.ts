import type { Request, Response } from "express";
import { PrescriptionStatus, Role } from "../../generated/prisma/enums.js";
import MedicineAvailabilityService from "../services/medicineAvailability.service.js";
import PrescriptionService from "../services/prescription.service.js";
import { auditClinicalView } from "../utils/auditClinicalView.js";
import { AppError } from "../utils/appError.js";
import { getRequiredPathParam, parseEnumQuery, parseNumberQuery, parseStringQuery } from "../shared/http/requestParsers.js";



const getActor = (req: Request) => {
  if (!req.user?.userId || !req.user.role) {
    throw new AppError("Chưa đăng nhập", 401);
  }

  return {
    userId: req.user.userId,
    role: req.user.role as Role,
  };
};

export const listPrescriptionsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PrescriptionService.list(
    {
      status:
        parseEnumQuery(req.query.status, PrescriptionStatus, "status"),
      doctorId:
        parseStringQuery(req.query.doctorId),
      patientId:
        parseStringQuery(req.query.patientId),
      medicalRecordId:
        parseStringQuery(req.query.medicalRecordId),
      appointmentId:
        parseStringQuery(req.query.appointmentId),
      prescriptionCode:
        parseStringQuery(req.query.prescriptionCode),
      q: parseStringQuery(req.query.q),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    },
    getActor(req),
  );

  return res.json({ success: true, data: result });
};

export const getPrescriptionHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.getById(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  await auditClinicalView(req, "PRESCRIPTION_VIEWED", "PRESCRIPTION", prescription.id);

  return res.json({ success: true, data: prescription });
};

export const createPrescriptionHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.createForMedicalRecord(
    getRequiredPathParam(req.params.id, "medicalRecordId"),
    req.body,
    getActor(req),
  );

  return res.status(201).json({
    success: true,
    message: "Tạo đơn thuốc thành công",
    data: prescription,
  });
};

export const updatePrescriptionHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.update(
    getRequiredPathParam(req.params.id),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật đơn thuốc thành công",
    data: prescription,
  });
};

export const issuePrescriptionHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.issue(
    getRequiredPathParam(req.params.id),
    getActor(req),
    { acknowledgeShortage: req.body?.acknowledgeShortage === true },
  );

  return res.json({
    success: true,
    message: "Phát hành đơn thuốc thành công",
    data: prescription,
  });
};

export const cancelPrescriptionHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.cancel(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Hủy đơn thuốc thành công",
    data: prescription,
  });
};

export const createPrescriptionItemHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.createItem(
    getRequiredPathParam(req.params.id, "prescriptionId"),
    req.body,
    getActor(req),
  );

  return res.status(201).json({
    success: true,
    message: "Thêm thuốc vào đơn thành công",
    data: prescription,
  });
};

export const updatePrescriptionItemHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.updateItem(
    getRequiredPathParam(req.params.id, "prescriptionId"),
    getRequiredPathParam(req.params.itemId, "itemId"),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật thuốc trong đơn thành công",
    data: prescription,
  });
};

export const resolvePrescriptionItemHandler = async (
  req: Request,
  res: Response,
) => {
  const prescription = await PrescriptionService.resolveItem(
    getRequiredPathParam(req.params.id, "prescriptionId"),
    getRequiredPathParam(req.params.itemId, "itemId"),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Đã cập nhật dòng thuốc",
    data: prescription,
  });
};

export const deletePrescriptionItemHandler = async (
  req: Request,
  res: Response,
) => {
  const item = await PrescriptionService.deleteItem(
    getRequiredPathParam(req.params.id, "prescriptionId"),
    getRequiredPathParam(req.params.itemId, "itemId"),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Xóa thuốc khỏi đơn thành công",
    data: item,
  });
};

// Danh mục thuốc cho bác sĩ khi kê đơn: chỉ tên, đơn vị và mức khả dụng, không có số tồn, giá hay lô.
export const listMedicineOptionsHandler = async (
  req: Request,
  res: Response,
) => {
  const data = await MedicineAvailabilityService.listOptions({
    q: parseStringQuery(req.query.q),
    limit: parseNumberQuery(req.query.limit),
  });
  return res.status(200).json({ success: true, data });
};

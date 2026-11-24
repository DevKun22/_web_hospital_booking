import type { Request, Response } from "express";
import {
  MedicalResultStatus,
  Role,
} from "../../generated/prisma/enums.js";
import MedicalRecordService from "../services/medicalRecord.service.js";
import SecureMedicalFileService, { sendMedicalFile } from "../services/secureMedicalFile.service.js";
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

export const listMedicalRecordsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await MedicalRecordService.list(
    {
      status:
        parseEnumQuery(req.query.status, MedicalResultStatus, "status"),
      doctorId:
        parseStringQuery(req.query.doctorId),
      patientId:
        parseStringQuery(req.query.patientId),
      recordCode:
        parseStringQuery(req.query.recordCode),
      q: parseStringQuery(req.query.q),
      date: parseStringQuery(req.query.date),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    },
    getActor(req),
  );

  return res.json({ success: true, data: result });
};

export const getMedicalRecordHandler = async (
  req: Request,
  res: Response,
) => {
  const record = await MedicalRecordService.getById(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  await auditClinicalView(req, "MEDICAL_RECORD_VIEWED", "MEDICAL_RECORD", record.id);

  return res.json({ success: true, data: record });
};

export const updateMedicalRecordHandler = async (
  req: Request,
  res: Response,
) => {
  const record = await MedicalRecordService.update(
    getRequiredPathParam(req.params.id),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật hồ sơ khám thành công",
    data: record,
  });
};

export const publishMedicalRecordHandler = async (
  req: Request,
  res: Response,
) => {
  const record = await MedicalRecordService.publish(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Phát hành kết quả khám thành công",
    data: record,
  });
};

export const archiveMedicalRecordHandler = async (
  req: Request,
  res: Response,
) => {
  const record = await MedicalRecordService.archive(
    getRequiredPathParam(req.params.id),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Lưu trữ hồ sơ khám thành công",
    data: record,
  });
};

export const createLabResultHandler = async (
  req: Request,
  res: Response,
) => {
  const labResult = await MedicalRecordService.createLabResult(
    getRequiredPathParam(req.params.id, "medicalRecordId"),
    req.body,
    getActor(req),
  );

  return res.status(201).json({
    success: true,
    message: "Tạo kết quả cận lâm sàng thành công",
    data: labResult,
  });
};

export const updateLabResultHandler = async (
  req: Request,
  res: Response,
) => {
  const labResult = await MedicalRecordService.updateLabResult(
    getRequiredPathParam(req.params.id, "medicalRecordId"),
    getRequiredPathParam(req.params.labResultId, "labResultId"),
    req.body,
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Cập nhật kết quả cận lâm sàng thành công",
    data: labResult,
  });
};

export const deleteLabResultHandler = async (
  req: Request,
  res: Response,
) => {
  const labResult = await MedicalRecordService.deleteLabResult(
    getRequiredPathParam(req.params.id, "medicalRecordId"),
    getRequiredPathParam(req.params.labResultId, "labResultId"),
    getActor(req),
  );

  return res.json({
    success: true,
    message: "Xóa kết quả cận lâm sàng thành công",
    data: labResult,
  });
};

// Mở tệp kết quả (đính kèm hồ sơ hoặc của một kết quả cận lâm sàng) qua máy chủ: tệp riêng tư
// không mở được bằng đường dẫn gốc. Ghi nhật ký như xem hồ sơ (bác sĩ điều trị thì không ghi).
export const downloadMedicalFileHandler = async (
  req: Request,
  res: Response,
) => {
  const source = await MedicalRecordService.getFileSource(
    getRequiredPathParam(req.params.id),
    getActor(req),
    req.params.labResultId ? getRequiredPathParam(req.params.labResultId, "labResultId") : undefined,
  );
  const file = await SecureMedicalFileService.fetch(source.url);
  await auditClinicalView(req, "MEDICAL_RECORD_VIEWED", "MEDICAL_RECORD", source.recordId);
  return sendMedicalFile(res, file, source.fileName);
};

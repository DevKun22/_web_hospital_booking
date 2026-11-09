import type { Request, Response, NextFunction } from "express";
import type {
  MedicalResultStatus,
  Role,
} from "../../generated/prisma/enums.js";
import MedicalRecordService from "../services/medicalRecord.service.js";
import SecureMedicalFileService, { sendMedicalFile } from "../services/secureMedicalFile.service.js";
import { auditClinicalView } from "../utils/auditClinicalView.js";
import { AppError } from "../utils/appError.js";

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const getParam = (value: string | string[] | undefined, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

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
  next: NextFunction,
) => {
  try {
    const result = await MedicalRecordService.list(
      {
        status:
          typeof req.query.status === "string"
            ? (req.query.status as MedicalResultStatus)
            : undefined,
        doctorId:
          typeof req.query.doctorId === "string"
            ? req.query.doctorId
            : undefined,
        patientId:
          typeof req.query.patientId === "string"
            ? req.query.patientId
            : undefined,
        recordCode:
          typeof req.query.recordCode === "string"
            ? req.query.recordCode
            : undefined,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        date: typeof req.query.date === "string" ? req.query.date : undefined,
        page: parseNumberQuery(req.query.page),
        limit: parseNumberQuery(req.query.limit),
      },
      getActor(req),
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getMedicalRecordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const record = await MedicalRecordService.getById(
      getParam(req.params.id),
      getActor(req),
    );

    await auditClinicalView(req, "MEDICAL_RECORD_VIEWED", "MEDICAL_RECORD", record.id);

    return res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

export const updateMedicalRecordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const record = await MedicalRecordService.update(
      getParam(req.params.id),
      req.body,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Cập nhật hồ sơ khám thành công",
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const publishMedicalRecordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const record = await MedicalRecordService.publish(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Phát hành kết quả khám thành công",
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const archiveMedicalRecordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const record = await MedicalRecordService.archive(
      getParam(req.params.id),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Lưu trữ hồ sơ khám thành công",
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const createLabResultHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const labResult = await MedicalRecordService.createLabResult(
      getParam(req.params.id, "medicalRecordId"),
      req.body,
      getActor(req),
    );

    return res.status(201).json({
      success: true,
      message: "Tạo kết quả cận lâm sàng thành công",
      data: labResult,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLabResultHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const labResult = await MedicalRecordService.updateLabResult(
      getParam(req.params.id, "medicalRecordId"),
      getParam(req.params.labResultId, "labResultId"),
      req.body,
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Cập nhật kết quả cận lâm sàng thành công",
      data: labResult,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLabResultHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const labResult = await MedicalRecordService.deleteLabResult(
      getParam(req.params.id, "medicalRecordId"),
      getParam(req.params.labResultId, "labResultId"),
      getActor(req),
    );

    return res.json({
      success: true,
      message: "Xóa kết quả cận lâm sàng thành công",
      data: labResult,
    });
  } catch (error) {
    next(error);
  }
};

// Mở tệp kết quả (đính kèm hồ sơ hoặc của một kết quả cận lâm sàng) qua máy chủ: tệp riêng tư
// không mở được bằng đường dẫn gốc. Ghi nhật ký như xem hồ sơ (bác sĩ điều trị thì không ghi).
export const downloadMedicalFileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const source = await MedicalRecordService.getFileSource(
      getParam(req.params.id),
      getActor(req),
      req.params.labResultId ? getParam(req.params.labResultId, "labResultId") : undefined,
    );
    const file = await SecureMedicalFileService.fetch(source.url);
    await auditClinicalView(req, "MEDICAL_RECORD_VIEWED", "MEDICAL_RECORD", source.recordId);
    return sendMedicalFile(res, file, source.fileName);
  } catch (error) {
    next(error);
  }
};

import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../utils/appError.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new AppError("Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF, SVG hoặc ICO", 400),
      );
      return;
    }

    callback(null, true);
  },
}).any();

// Tệp kết quả khám: PDF hoặc ảnh JPEG, PNG, WebP, mỗi lần một tệp, tối đa 10 MB. Loại tệp client
// khai báo chỉ để lọc sớm; nội dung thật được kiểm tra lại ở MediaAssetService.uploadMedicalFile.
export const MEDICAL_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const medicalMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const medicalFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDICAL_UPLOAD_MAX_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!medicalMimeTypes.has(file.mimetype)) {
      callback(new AppError("Chỉ hỗ trợ tệp PDF, JPG, PNG hoặc WEBP", 400));
      return;
    }
    callback(null, true);
  },
}).single("file");

// Đổi lỗi của multer (quá dung lượng, quá số tệp) thành lỗi 4xx dễ hiểu thay vì 500.
export const uploadMedicalFile: RequestHandler = (req, res, next) => {
  medicalFileUpload(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      next(
        new AppError(
          tooLarge ? "Tệp vượt quá 10 MB" : "Chỉ được tải một tệp mỗi lần",
          tooLarge ? 413 : 400,
        ),
      );
      return;
    }
    next(error);
  });
};

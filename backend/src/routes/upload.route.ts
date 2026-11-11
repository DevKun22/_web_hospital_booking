import { Router } from "express";
import {
  cleanupUnusedMediaAssetsHandler,
  deleteUnusedMediaAssetHandler,
  listMediaAssetsHandler,
  uploadImagesHandler,
  uploadMedicalFileHandler,
} from "../controllers/upload.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { uploadImages, uploadMedicalFile } from "../middlewares/upload.middleware.js";
import {
  limitMedicalFileUpload,
  limitPublicImageUpload,
} from "../middlewares/resourceConcurrency.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { cleanupUnusedMediaAssetsSchema } from "../validations/mediaAsset.validation.js";

const router = Router();

router.get(
  "/images",
  authDashboard,
  requirePermission("content.manage"),
  listMediaAssetsHandler,
);

router.post(
  "/images",
  authDashboard,
  requirePermission("content.manage"),
  limitPublicImageUpload,
  uploadImages,
  uploadImagesHandler,
);

// Tệp kết quả khám (PDF hoặc ảnh): chỉ bác sĩ có quyền ghi bệnh án, không dùng quyền nội dung.
router.post(
  "/medical-files",
  authDashboard,
  requirePermission("record.edit"),
  limitMedicalFileUpload,
  uploadMedicalFile,
  uploadMedicalFileHandler,
);

router.post(
  "/images/cleanup-unused",
  authDashboard,
  requirePermission("content.delete"),
  validate(cleanupUnusedMediaAssetsSchema),
  cleanupUnusedMediaAssetsHandler,
);

router.delete(
  "/images/:id",
  authDashboard,
  requirePermission("content.delete"),
  deleteUnusedMediaAssetHandler,
);

export default router;

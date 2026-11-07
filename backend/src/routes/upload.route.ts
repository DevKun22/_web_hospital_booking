import { Router } from "express";
import {
  cleanupUnusedMediaAssetsHandler,
  deleteUnusedMediaAssetHandler,
  listMediaAssetsHandler,
  uploadImagesHandler,
} from "../controllers/upload.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { uploadImages } from "../middlewares/upload.middleware.js";
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
  uploadImages,
  uploadImagesHandler,
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

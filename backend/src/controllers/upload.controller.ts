import { isProductionLike } from "../config/environment.js";
import type { Request, Response } from "express";
import MediaAssetService from "../services/mediaAsset.service.js";
import { AppError } from "../utils/appError.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

const getUploadedFiles = (files: Request["files"]) => {
  if (!files) return [];
  if (Array.isArray(files)) return files;

  return Object.values(files).flat();
};

export const uploadMedicalFileHandler = async (
  req: Request,
  res: Response,
) => {
  if (!req.is("multipart/form-data")) {
    throw new AppError("Request upload phải là multipart/form-data", 400);
  }
  if (!req.file) {
    throw new AppError("Chưa chọn tệp kết quả", 400);
  }

  const asset = await MediaAssetService.uploadMedicalFile(req.file, req.user?.userId);

  return res.status(201).json({
    success: true,
    message: "Tải tệp kết quả thành công",
    data: { item: asset },
  });
};

export const uploadImagesHandler = async (
  req: Request,
  res: Response,
) => {
  if (!req.is("multipart/form-data")) {
    throw new AppError("Request upload phải là multipart/form-data", 400);
  }

  const files = getUploadedFiles(req.files);
  const folder = typeof req.body.folder === "string" ? req.body.folder : "";

  if (!files.length) {
    return res.status(400).json({
      success: false,
      message: "Chưa chọn file upload",
      debug:
        isProductionLike()
          ? undefined
          : {
              contentType: req.headers["content-type"],
              body: req.body,
              bodyKeys: Object.keys(req.body || {}),
              files: req.files,
            },
    });
  }

  const items = await MediaAssetService.uploadImages(
    files,
    folder,
    req.user?.userId,
  );

  return res.status(201).json({
    success: true,
    message: "Upload ảnh thành công",
    data: {
      items,
    },
  });
};

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};


export const listMediaAssetsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await MediaAssetService.list({
    isUsed: parseBooleanQuery(req.query.isUsed),
    folder:
      parseStringQuery(req.query.folder),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({
    success: true,
    data: result,
  });
};

export const deleteUnusedMediaAssetHandler = async (
  req: Request,
  res: Response,
) => {
  const asset = await MediaAssetService.deleteUnused(getRequiredPathParam(req.params.id));

  return res.json({
    success: true,
    message: "Xóa ảnh chưa sử dụng thành công",
    data: asset,
  });
};

export const cleanupUnusedMediaAssetsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await MediaAssetService.cleanupUnused(req.body);

  return res.json({
    success: true,
    message: "Dọn ảnh chưa sử dụng thành công",
    data: result,
  });
};

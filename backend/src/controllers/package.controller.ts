import type { Request, Response } from "express";
import PackageService from "../services/package.service.js";
import { AppError } from "../utils/appError.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

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


export const listPackagesHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PackageService.list({
    search:
      parseStringQuery(req.query.search),
    isActive: parseBooleanQuery(req.query.isActive),
    isPopular: parseBooleanQuery(req.query.isPopular),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({ success: true, data: result });
};

export const getPackageHandler = async (
  req: Request,
  res: Response,
) => {
  const packageItem = await PackageService.getById(getRequiredPathParam(req.params.id));

  return res.json({ success: true, data: packageItem });
};

export const createPackageHandler = async (
  req: Request,
  res: Response,
) => {
  const packageItem = await PackageService.create(req.body);
  PublicBootstrapService.invalidate();

  return res.status(201).json({
    success: true,
    message: "Tạo gói khám thành công",
    data: packageItem,
  });
};

export const updatePackageHandler = async (
  req: Request,
  res: Response,
) => {
  const packageItem = await PackageService.update(
    getRequiredPathParam(req.params.id),
    req.body,
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật gói khám thành công",
    data: packageItem,
  });
};

export const deletePackageHandler = async (
  req: Request,
  res: Response,
) => {
  const packageItem = await PackageService.delete(getRequiredPathParam(req.params.id));
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Xóa gói khám thành công",
    data: packageItem,
  });
};

export const createPackageItemHandler = async (
  req: Request,
  res: Response,
) => {
  const item = await PackageService.createItem(
    getRequiredPathParam(req.params.id, "packageId"),
    req.body,
  );
  PublicBootstrapService.invalidate();

  return res.status(201).json({
    success: true,
    message: "Tạo hạng mục gói khám thành công",
    data: item,
  });
};

export const updatePackageItemHandler = async (
  req: Request,
  res: Response,
) => {
  const item = await PackageService.updateItem(
    getRequiredPathParam(req.params.id, "packageId"),
    getRequiredPathParam(req.params.itemId, "itemId"),
    req.body,
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật hạng mục gói khám thành công",
    data: item,
  });
};

export const deletePackageItemHandler = async (
  req: Request,
  res: Response,
) => {
  const item = await PackageService.deleteItem(
    getRequiredPathParam(req.params.id, "packageId"),
    getRequiredPathParam(req.params.itemId, "itemId"),
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Xóa hạng mục gói khám thành công",
    data: item,
  });
};

export const listPublicPackagesHandler = async (
  req: Request,
  res: Response,
) => {
  const packages = await PackageService.publicList({
    search:
      parseStringQuery(req.query.search),
    isPopular: parseBooleanQuery(req.query.isPopular),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({ success: true, data: packages });
};

export const listPublicPackageCatalogHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PackageService.publicCatalog({
    search:
      parseStringQuery(req.query.search),
    departmentId:
      parseStringQuery(req.query.departmentId),
    isPopular: parseBooleanQuery(req.query.isPopular),
    isBhytSupport: parseBooleanQuery(req.query.isBHYTSupport),
    sort:
      req.query.sort === "PRICE_ASC" ||
      req.query.sort === "PRICE_DESC" ||
      req.query.sort === "NAME_ASC" ||
      req.query.sort === "POPULAR_DESC"
        ? req.query.sort
        : undefined,
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({ success: true, data: result });
};

export const getPublicPackageHandler = async (
  req: Request,
  res: Response,
) => {
  const packageItem = await PackageService.publicGetBySlug(
    getRequiredPathParam(req.params.slug, "slug"),
  );

  return res.json({ success: true, data: packageItem });
};

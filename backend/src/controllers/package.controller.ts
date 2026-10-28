import type { Request, Response, NextFunction } from "express";
import PackageService from "../services/package.service.js";
import { AppError } from "../utils/appError.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";

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

const getParam = (value: string | string[] | undefined, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

export const listPackagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PackageService.list({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      isActive: parseBooleanQuery(req.query.isActive),
      isPopular: parseBooleanQuery(req.query.isPopular),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPackageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const packageItem = await PackageService.getById(getParam(req.params.id));

    return res.json({ success: true, data: packageItem });
  } catch (error) {
    next(error);
  }
};

export const createPackageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const packageItem = await PackageService.create(req.body);
    PublicBootstrapService.invalidate();

    return res.status(201).json({
      success: true,
      message: "Tạo gói khám thành công",
      data: packageItem,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePackageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const packageItem = await PackageService.update(
      getParam(req.params.id),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật gói khám thành công",
      data: packageItem,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePackageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const packageItem = await PackageService.delete(getParam(req.params.id));
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Xóa gói khám thành công",
      data: packageItem,
    });
  } catch (error) {
    next(error);
  }
};

export const createPackageItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const item = await PackageService.createItem(
      getParam(req.params.id, "packageId"),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.status(201).json({
      success: true,
      message: "Tạo hạng mục gói khám thành công",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePackageItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const item = await PackageService.updateItem(
      getParam(req.params.id, "packageId"),
      getParam(req.params.itemId, "itemId"),
      req.body,
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Cập nhật hạng mục gói khám thành công",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePackageItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const item = await PackageService.deleteItem(
      getParam(req.params.id, "packageId"),
      getParam(req.params.itemId, "itemId"),
    );
    PublicBootstrapService.invalidate();

    return res.json({
      success: true,
      message: "Xóa hạng mục gói khám thành công",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const listPublicPackagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const packages = await PackageService.publicList({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      isPopular: parseBooleanQuery(req.query.isPopular),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({ success: true, data: packages });
  } catch (error) {
    next(error);
  }
};

export const listPublicPackageCatalogHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PackageService.publicCatalog({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      departmentId:
        typeof req.query.departmentId === "string"
          ? req.query.departmentId
          : undefined,
      isPopular: parseBooleanQuery(req.query.isPopular),
      isBhytSupport: parseBooleanQuery(req.query.isBHYTSupport),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPublicPackageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const packageItem = await PackageService.publicGetBySlug(
      getParam(req.params.slug, "slug"),
    );

    return res.json({ success: true, data: packageItem });
  } catch (error) {
    next(error);
  }
};

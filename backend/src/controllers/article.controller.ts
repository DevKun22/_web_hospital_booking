import type { NextFunction, Request, Response } from "express";
import ArticleService from "../services/article.service.js";
import { AppError } from "../utils/appError.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

const getParam = (value: string | string[] | undefined) => {
  const param = Array.isArray(value) ? value[0] : value;
  if (!param) throw new AppError("Thiếu mã bài viết", 400);
  return param;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const actorOf = (req: Request) => {
  if (!req.user) throw new AppError("Chưa đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role };
};

// ---- Công khai ----

export const listPublicArticlesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 30 });
    const result = await ArticleService.listPublic({
      category: text(req.query.category),
      departmentId: text(req.query.departmentId),
      search: text(req.query.q),
      skip,
      limit,
    });
    return res.json({ success: true, data: { items: result.items, categories: result.categories, pagination: paginationMeta(page, limit, result.total) } });
  } catch (error) {
    next(error);
  }
};

export const getPublicArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await ArticleService.getPublicBySlug(getParam(req.params.slug)) });
  } catch (error) {
    next(error);
  }
};

// ---- Dashboard ----

export const listDashboardArticlesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const status = req.query.status === "DRAFT" || req.query.status === "PUBLISHED" ? req.query.status : undefined;
    const result = await ArticleService.listDashboard({ status, search: text(req.query.q), skip, limit });
    return res.json({ success: true, data: { items: result.items, pagination: paginationMeta(page, limit, result.total) } });
  } catch (error) {
    next(error);
  }
};

export const getDashboardArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await ArticleService.getById(getParam(req.params.id)) });
  } catch (error) {
    next(error);
  }
};

export const createArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(201).json({ success: true, data: await ArticleService.create(req.body, actorOf(req)) });
  } catch (error) {
    next(error);
  }
};

export const updateArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await ArticleService.update(getParam(req.params.id), req.body, actorOf(req)) });
  } catch (error) {
    next(error);
  }
};

export const publishArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await ArticleService.publish(getParam(req.params.id), req.body.reviewerName) });
  } catch (error) {
    next(error);
  }
};

export const unpublishArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await ArticleService.unpublish(getParam(req.params.id)) });
  } catch (error) {
    next(error);
  }
};

export const deleteArticleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ArticleService.remove(getParam(req.params.id));
    return res.json({ success: true, message: "Đã xóa bài viết" });
  } catch (error) {
    next(error);
  }
};

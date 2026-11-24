import type { Request, Response } from "express";
import ArticleService from "../services/article.service.js";
import { AppError } from "../utils/appError.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { getRequiredPathParam } from "../shared/http/requestParsers.js";


const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const actorOf = (req: Request) => {
  if (!req.user) throw new AppError("Chưa đăng nhập", 401);
  return { userId: req.user.userId, role: req.user.role };
};

// ---- Công khai ----

export const listPublicArticlesHandler = async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 30 });
  const result = await ArticleService.listPublic({
    category: text(req.query.category),
    departmentId: text(req.query.departmentId),
    search: text(req.query.q),
    skip,
    limit,
  });
  return res.json({ success: true, data: { items: result.items, categories: result.categories, pagination: paginationMeta(page, limit, result.total) } });
};

export const getPublicArticleHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await ArticleService.getPublicBySlug(getRequiredPathParam(req.params.slug, "mã bài viết")) });
};

// ---- Dashboard ----

export const listDashboardArticlesHandler = async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const stage = req.query.stage === "PENDING_REVIEW" || req.query.stage === "READY" || req.query.stage === "PUBLISHED" ? req.query.stage : undefined;
  const result = await ArticleService.listDashboard({ stage, search: text(req.query.q), skip, limit });
  return res.json({ success: true, data: { items: result.items, pagination: paginationMeta(page, limit, result.total) } });
};

export const getDashboardArticleHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await ArticleService.getById(getRequiredPathParam(req.params.id, "mã bài viết")) });
};

export const createArticleHandler = async (req: Request, res: Response) => {
  return res.status(201).json({ success: true, data: await ArticleService.create(req.body, actorOf(req)) });
};

export const updateArticleHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await ArticleService.update(getRequiredPathParam(req.params.id, "mã bài viết"), req.body, actorOf(req)) });
};

export const reviewArticleHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await ArticleService.review(getRequiredPathParam(req.params.id, "mã bài viết"), actorOf(req)) });
};

export const publishArticleHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await ArticleService.publish(getRequiredPathParam(req.params.id, "mã bài viết")) });
};

export const unpublishArticleHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await ArticleService.unpublish(getRequiredPathParam(req.params.id, "mã bài viết")) });
};

export const deleteArticleHandler = async (req: Request, res: Response) => {
  await ArticleService.remove(getRequiredPathParam(req.params.id, "mã bài viết"));
  return res.json({ success: true, message: "Đã xóa bài viết" });
};

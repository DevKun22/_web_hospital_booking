import type { Request, Response } from "express";
import PublicSearchService from "../services/search/search.service.js";
import {
  SEARCH_DOCUMENT_TYPES,
  type SearchDocumentType,
} from "../services/search/search.types.js";
import { AppError } from "../utils/appError.js";

const parseLimit = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new AppError("Tham số limit không hợp lệ", 400);
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new AppError("Tham số limit phải là số nguyên dương", 400);
  }

  return limit;
};

const parseType = (value: unknown): SearchDocumentType | "all" | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new AppError("Tham số type không hợp lệ", 400);
  }

  if (value === "all") return "all";
  if (SEARCH_DOCUMENT_TYPES.includes(value as SearchDocumentType)) {
    return value as SearchDocumentType;
  }

  throw new AppError("Loại dữ liệu tìm kiếm không hợp lệ", 400);
};

const parseSearchQuery = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new AppError("Từ khóa tìm kiếm không hợp lệ", 400);
  }

  const q = value.replace(/\s+/g, " ").trim();
  if (q.length > 120) {
    throw new AppError("Từ khóa tìm kiếm tối đa 120 ký tự", 400);
  }

  return q;
};

export const publicSearchHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await PublicSearchService.search({
    q: parseSearchQuery(req.query.q),
    type: parseType(req.query.type),
    limit: parseLimit(req.query.limit),
  });

  return res.json({
    success: true,
    data: result,
  });
};

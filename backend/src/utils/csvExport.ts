import type { Response } from "express";
import { AppError } from "./appError.js";

// Bộ xuất CSV dùng chung cho mọi báo cáo của dashboard. Mục tiêu: mở được bằng Excel (UTF-8 có
// BOM, xuống dòng CRLF), không bị chèn công thức, và không bao giờ trả về lượng dữ liệu quá lớn.

export const EXPORT_MAX_ROWS = 5000;
export const EXPORT_MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type CsvCell = string | number | boolean | Date | null | undefined;

const pad = (value: number) => String(value).padStart(2, "0");

// Thời điểm hiển thị theo giờ Việt Nam để khớp với cách người dùng đọc báo cáo.
export const formatVnDateTime = (date: Date) => {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return (
    `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())} ` +
    `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())}`
  );
};

// Ô bắt đầu bằng = + - @ (hoặc tab, xuống dòng) bị Excel hiểu là công thức; thêm dấu nháy đơn để
// nó luôn là chữ. Chỉ áp dụng cho chuỗi, số thật (kể cả số âm) giữ nguyên.
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value: CsvCell): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  const text = value instanceof Date ? formatVnDateTime(value) : value;
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const buildCsv = (headers: string[], rows: CsvCell[][]) =>
  "﻿" +
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
  "\r\n";

// Lấy tối đa EXPORT_MAX_ROWS + 1 dòng để biết có vượt giới hạn hay không, rồi từ chối thay vì cắt
// bớt âm thầm (báo cáo thiếu dòng nguy hiểm hơn là không có báo cáo).
export const assertWithinRowLimit = (rowCount: number) => {
  if (rowCount > EXPORT_MAX_ROWS) {
    throw new AppError(
      `Có hơn ${EXPORT_MAX_ROWS} dòng, hãy thu hẹp khoảng ngày hoặc bộ lọc`,
      413,
      "EXPORT_TOO_LARGE",
    );
  }
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Nhận from, to dạng YYYY-MM-DD (giờ Việt Nam, gồm cả ngày cuối). Mặc định 30 ngày gần nhất.
export const parseExportRange = (query: { from?: unknown; to?: unknown }, now = new Date()) => {
  const read = (value: unknown, field: string) => {
    if (value === undefined || value === "") return undefined;
    if (typeof value !== "string" || !DATE_ONLY.test(value) || Number.isNaN(Date.parse(value))) {
      throw new AppError(`${field} phải có dạng YYYY-MM-DD`, 400, "EXPORT_INVALID_RANGE");
    }
    return value;
  };

  const toText = read(query.to, "to") ?? formatVnDateTime(now).slice(0, 10);
  const to = new Date(`${toText}T23:59:59.999+07:00`);
  const fromText =
    read(query.from, "from") ?? formatVnDateTime(new Date(to.getTime() - 29 * DAY_MS)).slice(0, 10);
  const from = new Date(`${fromText}T00:00:00+07:00`);

  if (from.getTime() > to.getTime()) {
    throw new AppError("from phải trước hoặc bằng to", 400, "EXPORT_INVALID_RANGE");
  }
  if (to.getTime() - from.getTime() > EXPORT_MAX_RANGE_DAYS * DAY_MS) {
    throw new AppError(
      `Khoảng ngày tối đa ${EXPORT_MAX_RANGE_DAYS} ngày`,
      400,
      "EXPORT_INVALID_RANGE",
    );
  }
  return { from, to, fromText, toText };
};

export const sendCsv = (res: Response, baseName: string, csv: string) => {
  const stamp = formatVnDateTime(new Date()).slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${stamp}.csv"`);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(csv);
};

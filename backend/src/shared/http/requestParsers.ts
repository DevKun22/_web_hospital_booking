import { AppError } from "../../utils/appError.js";

type PathParam = string | string[] | undefined;

/**
 * Đọc một tham số đường dẫn bắt buộc; thiếu thì trả lỗi 400 "Thiếu <tên>".
 */
export const getRequiredPathParam = (value: PathParam, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

/**
 * Tham số truy vấn dạng "true"/"false"; giá trị khác là undefined để nơi dùng tự áp mặc định.
 */
export const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

/**
 * Tham số truy vấn dạng số tùy chọn: không gửi, rỗng hoặc không phải số thì undefined (nơi dùng tự áp mặc định).
 */
export const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

/**
 * Tham số truy vấn dạng chuỗi tùy chọn: chỉ nhận một giá trị chuỗi (bỏ mảng khi tham số lặp lại), còn lại là undefined.
 */
export const parseStringQuery = (value: unknown) =>
  typeof value === "string" ? value : undefined;

/**
 * Tham số truy vấn thuộc một tập giá trị cố định (trạng thái, vai trò...). Không gửi hoặc rỗng là undefined;
 * giá trị lạ trả lỗi 400 thay vì đi thẳng xuống cơ sở dữ liệu. `allowed` là mảng hoặc đối tượng enum của Prisma.
 */
export const parseEnumQuery = <T extends string>(
  value: unknown,
  allowed: readonly T[] | Record<string, T>,
  field: string,
  code = "INVALID_FILTER",
): T | undefined => {
  if (value === undefined || value === "") return undefined;
  const values: readonly T[] = Array.isArray(allowed) ? allowed : Object.values(allowed);
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new AppError(`${field} không hợp lệ`, 400, code);
  }
  return value as T;
};

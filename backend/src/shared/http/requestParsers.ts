import { AppError } from "../../utils/appError.js";

export type PathParam = string | string[] | undefined;

/**
 * Reads one Express path parameter while preserving the existing API error
 * envelope through AppError.
 */
export const getRequiredPathParam = (value: PathParam, name = "id") => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(`Thiếu ${name}`, 400);
  }

  return param;
};

/**
 * Parses the optional boolean query convention used by dashboard endpoints.
 * Unsupported values remain undefined so each use case can apply its default.
 */
export const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

/**
 * Parses the existing optional numeric query convention without introducing
 * range or integer rules that could change endpoint behaviour.
 */
export const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

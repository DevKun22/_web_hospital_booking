import { AppError } from "./appError.js";

/**
 * Sinh mã ngẫu nhiên chưa có trong cơ sở dữ liệu: thử tối đa `attempts` lần rồi báo lỗi.
 * `isTaken` kiểm tra mã đã tồn tại chưa (thường là một truy vấn `findUnique` theo cột duy nhất).
 */
export const generateUniqueCode = async (
  generate: () => string,
  isTaken: (code: string) => Promise<boolean>,
  failureMessage: string,
  attempts = 10,
) => {
  for (let index = 0; index < attempts; index += 1) {
    const code = generate();
    if (!(await isTaken(code))) return code;
  }
  throw new AppError(failureMessage, 500);
};

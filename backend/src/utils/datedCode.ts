import { randomInt } from "crypto";
import { getVietnamNowParts } from "./time.js";

/**
 * Mã nghiệp vụ dạng TIỀN_TỐ + ngày (theo giờ Việt Nam, YYYYMMDD) + số ngẫu nhiên, ví dụ BK20261124123456.
 * Mọi loại mã (lịch hẹn, hồ sơ, đơn thuốc, thanh toán, hóa đơn) dùng chung hàm này; tính duy nhất do
 * generateUniqueCode kiểm tra trong cơ sở dữ liệu. `digits` là số chữ số phần ngẫu nhiên (mặc định 6).
 */
export const generateDatedCode = (prefix: string, digits = 6) => {
  const date = getVietnamNowParts().date.replaceAll("-", "");
  const min = 10 ** (digits - 1);
  return `${prefix}${date}${randomInt(min, min * 10)}`;
};

/** Tiền tố của từng loại mã, gom một chỗ để không trùng nhau. */
export const CODE_PREFIX = {
  booking: "BK",
  medicalRecord: "MR",
  prescription: "PR",
  payment: "PAY",
  invoice: "INV",
  invoiceBarcode: "BC",
  invoiceSupplement: "BS",
} as const;

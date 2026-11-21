// Ô nhập tiền: người dùng gõ có dấu chấm ngăn cách, hệ thống giữ chuỗi chữ số thuần.
export const parseMoneyInput = (value: string) => value.replace(/\D/g, "");

export const formatMoneyInput = (value: string) => {
  const digits = parseMoneyInput(value);
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};

export const toMoneyNumber = (value: string) => Number(parseMoneyInput(value) || 0);

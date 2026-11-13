// Định dạng hiển thị dùng chung cho phần người dùng. Mọi ngày giờ theo giờ Việt Nam.
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const NO_DATE = "Chưa cập nhật";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("vi-VN");

// 1.250.000 ₫
export const formatCurrency = (value?: number | null) => currencyFormatter.format(value || 0);

// Như formatCurrency nhưng trả chuỗi rỗng khi chưa có giá (ô tìm kiếm, thẻ gợi ý).
export const formatOptionalCurrency = (value?: number | null) =>
  value ? currencyFormatter.format(value) : "";

// 1.250.000 đ
export const formatMoney = (value?: number | null) => `${numberFormatter.format(value || 0)} đ`;

const toDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateFormatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("vi-VN", { ...options, timeZone: TIME_ZONE });

const shortDate = dateFormatter({ day: "2-digit", month: "2-digit", year: "numeric" });
const longDate = dateFormatter({ dateStyle: "long" });
const weekdayDate = dateFormatter({ weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
const shortDateTime = dateFormatter({ dateStyle: "short", timeStyle: "short" });

// 13/11/2026
export const formatShortDate = (value?: string | null, fallback = NO_DATE) => {
  const date = toDate(value);
  return date ? shortDate.format(date) : fallback;
};

// 13 tháng 11, 2026
export const formatLongDate = (value?: string | null, fallback = NO_DATE) => {
  const date = toDate(value);
  return date ? longDate.format(date) : fallback;
};

// Thứ Sáu, 13/11/2026
export const formatWeekdayDate = (value?: string | null, fallback = NO_DATE) => {
  const date = toDate(value);
  return date ? weekdayDate.format(date) : fallback;
};

// 13/11/2026 14:30
export const formatShortDateTime = (value?: string | null, fallback = "Chưa xác định") => {
  const date = toDate(value);
  return date ? shortDateTime.format(date) : fallback;
};

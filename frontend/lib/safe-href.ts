// Chỉ cho liên kết trong site hoặc https; còn lại dùng giá trị dự phòng (đường dẫn do quản trị nhập không được trỏ ra giao thức nguy hiểm).
export const safeHref = (value: string | null | undefined, fallback = "/") => {
  const href = value?.trim();
  if (!href) return fallback;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    return new URL(href).protocol === "https:" ? href : fallback;
  } catch {
    return fallback;
  }
};

// Đường dẫn không dấu từ tiêu đề tiếng Việt; cùng thuật toán với backend (createSlug) để liên kết trỏ đúng mục.
export const createSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

import { foldVietnamese } from "../services/chatbot/rules/text-normalizer.js";

/**
 * Lọc tìm kiếm không phân biệt dấu cho danh mục công khai (khoa, gói khám): "tim mach" khớp "Tim mạch".
 * Danh mục đã tải đủ để sắp xếp theo điểm, nên lọc ngay trên bộ nhớ thay vì so `contains` có dấu trong cơ sở dữ liệu.
 * Mỗi từ trong câu tìm phải xuất hiện ở ít nhất một trường.
 */
export const createFoldedMatcher = (search?: string) => {
  const terms = foldVietnamese(search ?? "")
    .split(" ")
    .filter(Boolean);
  if (!terms.length) return null;

  return (fields: Array<string | null | undefined>) => {
    const haystack = foldVietnamese(fields.filter(Boolean).join(" "));
    return terms.every((term) => haystack.includes(term));
  };
};

import { foldVietnamese } from "../chatbot/rules/text-normalizer.js";

// Biến câu người dùng gõ thành dạng an toàn để truy vấn full-text: bỏ dấu (cùng foldVietnamese với chatbot và với hàm SQL
// trong migration SearchDocument), chỉ giữ chữ và số, tối đa 10 từ. Nhờ chỉ còn [a-z0-9] nên chuỗi tsquery không thể chứa
// toán tử của Postgres (&, |, !, :, dấu nháy) dù người dùng gõ gì.
const MAX_TOKENS = 10;

export const parseSearchText = (raw: string) => {
  const tokens = foldVietnamese(raw)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS);

  return {
    tokens,
    // Cụm đã chuẩn hóa, dùng để so với tiêu đề (cụm trọn vẹn, bắt đầu bằng cụm).
    phrase: tokens.join(" "),
    // Mọi từ phải xuất hiện (AND). Chỉ từ cuối (từ đang gõ) khớp theo tiền tố nên gõ dở "tim ma" vẫn ra "tim mạch"; các từ
    // trước khớp nguyên từ để tập kết quả không phình ra vì tiền tố.
    tsQuery: tokens.map((token, index) => (index === tokens.length - 1 ? `${token}:*` : token)).join(" & "),
  };
};

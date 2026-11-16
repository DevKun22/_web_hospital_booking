const foldKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Bỏ các đoạn lặp lại nguyên văn trong cùng một câu trả lời (AI hay lặp khi ghép nhiều nguồn). */
export const sanitizeReplyText = (reply: string) => {
  const seen = new Set<string>();

  return reply
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => {
      const key = foldKey(part);
      if (!key || !seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    })
    .join("\n\n");
};

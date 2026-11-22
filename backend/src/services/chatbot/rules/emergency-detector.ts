import { foldVietnamese, hasPhrase } from "./text-normalizer.js";

// Từ khóa cấp cứu (đã bỏ dấu). "ngất" tách riêng vì bỏ dấu sẽ trùng "ngạt" (ngạt mũi) và "ngắt".
const emergencyKeywords = [
  "dau nguc du doi",
  "kho tho nang",
  "co giat",
  "yeu liet",
  "liet nua nguoi",
  "chay mau nhieu",
  "dau dau du doi",
  "dau dau dot ngot",
];

const LETTER_BOUNDARY = "[^\\p{L}\\p{N}]";
// Có dấu: khớp đúng từ "ngất" (không bắt "ngạt", "ngắt").
const FAINT_ACCENTED = new RegExp(`(^|${LETTER_BOUNDARY})ngất(${LETTER_BOUNDARY}|$)`, "u");
// Gõ không dấu: "ngat" là từ nhập nhằng; chỉ coi là ngất khi cả tin không có dấu nào và không đi với "mũi", "thở" (ngạt mũi, ngạt thở nhẹ).
const FAINT_UNACCENTED = /(^|[^a-z0-9])ngat(?!\s+(mui|tho))([^a-z0-9]|$)/;

const hasFaintSignal = (message: string) => {
  const lowered = message.normalize("NFC").toLowerCase();
  if (FAINT_ACCENTED.test(lowered)) return true;
  const hasDiacritics = lowered !== foldVietnamese(lowered);
  return !hasDiacritics && FAINT_UNACCENTED.test(lowered);
};

export const hasEmergencySignal = (normalizedMessage: string) => {
  const foldedMessage = foldVietnamese(normalizedMessage);

  return hasFaintSignal(normalizedMessage) || emergencyKeywords.some((keyword) => hasPhrase(foldedMessage, keyword));
};

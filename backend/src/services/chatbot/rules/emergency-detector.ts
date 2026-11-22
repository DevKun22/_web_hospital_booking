import { foldVietnamese } from "./text-normalizer.js";

// DANH SÁCH NÀY CẦN BÁC SĨ RÀ SOÁT trước khi dùng cho người khám thật. Nguyên tắc: thà báo thừa còn hơn bỏ sót, nên cụm đứng một mình
// (đau ngực, khó thở...) cũng báo, kể cả khi người dùng chỉ hỏi chung; nội dung thẻ cấp cứu là lời nhắc gọi 115 có sẵn, không thêm lời khuyên y khoa.
// Mỗi cụm đã bỏ dấu và khớp theo TỪ NGUYÊN VẸN (không khớp một phần của từ khác). "ngất" xử lý riêng ở dưới vì bỏ dấu sẽ trùng "ngạt", "ngắt".
const emergencyPhrases = [
  "dau nguc",
  "kho tho",
  "ngung tho",
  "co giat",
  "dot quy",
  "liet nua nguoi",
  "yeu liet",
  "meo mieng",
  "non ra mau",
  "non mau",
  "ho ra mau",
  "ho mau",
  "chay mau nhieu",
  "ngo doc",
  "tu tu",
  "tu lam hai",
  "tu hai ban than",
  "dau dau du doi",
  "dau dau dot ngot",
];

const phrasePattern = (phrase: string) => new RegExp(`(^|[^a-z0-9])${phrase.split(" ").join("[ ]+")}([^a-z0-9]|$)`);
const emergencyPatterns = emergencyPhrases.map(phrasePattern);

const LETTER_BOUNDARY = "[^\p{L}\p{N}]";
// Có dấu: khớp đúng từ "ngất" (không bắt "ngạt", "ngắt").
const FAINT_ACCENTED = new RegExp(`(^|${LETTER_BOUNDARY})ngất(${LETTER_BOUNDARY}|$)`, "u");
// Gõ không dấu: "ngat" là từ nhập nhằng; chỉ coi là ngất khi cả tin không có dấu nào và không đi với "mũi", "thở" (ngạt mũi, ngạt thở).
const FAINT_UNACCENTED = /(^|[^a-z0-9])ngat(?!\s+(mui|tho))([^a-z0-9]|$)/;

const hasFaintSignal = (message: string) => {
  const lowered = message.normalize("NFC").toLowerCase();
  if (FAINT_ACCENTED.test(lowered)) return true;
  const hasDiacritics = lowered !== foldVietnamese(lowered);
  return !hasDiacritics && FAINT_UNACCENTED.test(lowered);
};

export const hasEmergencySignal = (normalizedMessage: string) => {
  const foldedMessage = foldVietnamese(normalizedMessage);
  return hasFaintSignal(normalizedMessage) || emergencyPatterns.some((pattern) => pattern.test(foldedMessage));
};

import { foldVietnamese } from "../rules/text-normalizer.js";

// Định tuyến bằng quy tắc: câu chào, hỏi chức năng, làm lại hay bấm nút không cần AI phân tích.
// Chỉ những câu còn lại mới tốn một lần gọi AI để hiểu ý định (xem chatbot.service).

type RuleRoute = "GREETING" | "CAPABILITIES" | "RESET" | "NEEDS_NLU";

const GREETING = /^(xin chao|chao|chao ban|chao bac si|hello|hi|alo|hey)( ban| ad| admin| nhe| a)?[!. ]*$/;
const CAPABILITIES = /(ban|chatbot|tro ly|he thong|bot).{0,24}(lam duoc gi|giup duoc gi|ho tro (duoc )?gi|co the giup gi|co chuc nang)|(lam duoc gi|giup duoc gi|ho tro gi)$/;
const RESET = /(lam lai|bat dau lai|xoa (het|lua chon)|dat lai tu dau|huy lua chon|chon lai tu dau)/;

export const routeByRules = (message: string): RuleRoute => {
  const folded = foldVietnamese(message).replace(/[?!.,]+$/g, "").trim();
  if (GREETING.test(folded)) return "GREETING";
  if (RESET.test(folded)) return "RESET";
  if (CAPABILITIES.test(folded)) return "CAPABILITIES";
  return "NEEDS_NLU";
};

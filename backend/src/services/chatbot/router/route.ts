import type { ChatOperation } from "../chatbot.types.js";
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

// Đường lùi khi AI không dùng được: chỉ các dấu hiệu rất rõ về lịch hẹn của chính người dùng. Câu hỏi quy định chung
// ("hủy lịch trước bao lâu", "có được đổi lịch không") có từ để hỏi nên không bị bắt ở đây mà đi kho tri thức.
const POLICY_QUESTION = /\b(bao lau|truoc may|duoc khong|co duoc|the nao|nhu the nao|quy dinh|chinh sach|phi|mat phi|hoan tien)\b/;
const CANCEL_MINE = /\b(huy|xoa) (giup |cho )?(toi |minh |em )?(cai )?(lich|lich hen|lich kham|cuoc hen)\b/;
const RESCHEDULE_MINE = /\b(doi|doi lai|chuyen|doi sang|lui|doi ngay) (giup |cho )?(toi |minh |em )?(lich|lich hen|lich kham|cuoc hen)\b|\bdoi lich\b|\bdoi gio kham\b/;
const LOOKUP_MINE = /\b(lich hen|lich kham) (cua )?(toi|minh|em)\b|\b(xem|tra cuu|kiem tra) (lai )?(lich hen|lich kham|lich da dat)\b|\bBK\d{14}\b/i;

export const routeByHeuristics = (message: string): ChatOperation | null => {
  const folded = foldVietnamese(message);
  if (POLICY_QUESTION.test(folded)) return null;
  if (CANCEL_MINE.test(folded)) return "CANCEL_APPOINTMENT";
  if (RESCHEDULE_MINE.test(folded)) return "RESCHEDULE_APPOINTMENT";
  if (LOOKUP_MINE.test(folded)) return "LOOKUP_APPOINTMENT";
  return null;
};

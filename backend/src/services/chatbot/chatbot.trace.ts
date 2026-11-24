import { randomUUID } from "crypto";
import type { ChatOperation } from "./chatbot.types.js";
import type { RetrievalTrace } from "./flows/info.flow.js";
import type { IntentHandler } from "./intent/intent.spec.js";
import type { SessionBinding } from "./chatbot.session.js";

// Vết xử lý một tin nhắn: đủ để biết Kun đã hiểu gì, đi nhánh nào, dựa vào đoạn tri thức nào, gọi AI mấy lần, chậm ở đâu.
// KHÔNG chứa nội dung tin nhắn, câu trả lời, mã OTP, token, tên người khám hay chi tiết lịch hẹn; chỉ mã, nhãn và số đo.
// Vết được lưu vào ChatbotLog.trace (chỉ người có quyền chatbot.view xem qua dashboard) và in ra nhật ký máy chủ.

export type OperationSource = "ACTION" | "RULE" | "NLU" | "HEURISTIC" | "SAFETY";

export type AICallTrace = { purpose: "NLU" | "RAG_ANSWER" | "TRIAGE_REPLY" | "ARTICLE_SUMMARY"; ok: boolean; ms: number };

export type ChatbotTrace = {
  traceId: string;
  sessionBinding: SessionBinding;
  authenticated: boolean;
  operation: ChatOperation | null;
  secondaryOperation: ChatOperation | null;
  operationSource: OperationSource | null;
  handler: IntentHandler | "SAFETY" | "ARTICLE" | null;
  stateBefore: string | null;
  stateAfter: string | null;
  retrieval: RetrievalTrace[];
  aiCalls: AICallTrace[];
  stages: Record<string, number>;
  latencyMs: number;
  /** Bộ phân tích ngày giờ xác định đã nhận ra gì (chỉ cờ, không ghi giá trị). */
  deterministic: { date: boolean; time: boolean; period: boolean; bookingCode: boolean };
  /** Lượt này có thay đổi dữ liệu thật (hủy lịch) hay không. */
  mutated: boolean;
  /** Lượt ghi phiên bị từ chối vì có yêu cầu khác của cùng phiên ghi trước (đồng thời). */
  conflict: boolean;
  numericRejected: boolean;
};

export const createTrace = (input: { sessionBinding: SessionBinding; authenticated: boolean; stateBefore: string | null }): ChatbotTrace => ({
  traceId: randomUUID(),
  sessionBinding: input.sessionBinding,
  authenticated: input.authenticated,
  operation: null,
  secondaryOperation: null,
  operationSource: null,
  handler: null,
  stateBefore: input.stateBefore,
  stateAfter: null,
  retrieval: [],
  aiCalls: [],
  stages: {},
  latencyMs: 0,
  deterministic: { date: false, time: false, period: false, bookingCode: false },
  mutated: false,
  conflict: false,
  numericRejected: false,
});

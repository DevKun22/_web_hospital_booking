import type { AIChatbotOutput, ChatBookingDraft, ChatbotResponseSource } from "../chatbot.types.js";
import KnowledgeService from "../rag/knowledge.service.js";
import { answerFromSources, extractiveAnswer, type GroundedAnswer } from "../rag/generator.js";
import { logger } from "../../../observability/logger.js";
import type { ChatbotSource, RetrievedChunk } from "../rag/rag.types.js";

// Hỏi thông tin (giá, giờ làm việc, chính sách, bác sĩ, quy trình): truy hồi trong kho tri thức rồi để AI trả lời có căn cứ.
// AI không dùng được thì trả nguyên văn đoạn khớp nhất; không có đoạn đủ liên quan thì nói thẳng là chưa có thông tin.

type InfoResult = { output: AIChatbotOutput; source: ChatbotResponseSource; sourceIds: string[] };

const RETRIEVED_LIMIT = 5;

const knowledgeActions = (hasAnswer: boolean): AIChatbotOutput["suggestedActions"] => [
  { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  { type: "CONTACT_STAFF", label: hasAnswer ? "Liên hệ hỗ trợ" : "Hỏi nhân viên hỗ trợ", payload: {} },
];

const toSources = (chunks: RetrievedChunk[], ids: string[]): ChatbotSource[] =>
  ids
    .map((id) => chunks.find((item) => item.chunk.id === id))
    .filter((item): item is RetrievedChunk => Boolean(item))
    .map((item) => ({ id: item.chunk.id, type: item.chunk.sourceType, title: item.chunk.title }));

export const noInformationOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Mình chưa tìm thấy thông tin phù hợp trong dữ liệu của cơ sở khám cho câu hỏi này. Bạn có thể hỏi về chuyên khoa, bác sĩ, gói khám, giá, giờ làm việc và chính sách đặt lịch, hoặc liên hệ nhân viên để được hỗ trợ.",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 0.3,
  draft,
  suggestedActions: knowledgeActions(false),
});

class InfoFlow {
  /** Trả lời một câu hỏi thông tin; null khi kho không có đoạn nào liên quan. */
  async answer(input: { message: string; draft: ChatBookingDraft; aiEnabled: boolean; model?: string }): Promise<InfoResult | null> {
    const chunks = await KnowledgeService.retrieve(input.message, { limit: RETRIEVED_LIMIT });
    if (!chunks.length) return null;

    // AI trả lời "không đủ căn cứ" thì tôn trọng; chỉ khi AI tắt hoặc không gọi được mới trả nguyên văn đoạn khớp nhất.
    let grounded: GroundedAnswer | null = null;
    let aiFailed = !input.aiEnabled;
    if (input.aiEnabled) {
      try {
        grounded = await answerFromSources({ question: input.message, chunks, model: input.model });
      } catch (error) {
        aiFailed = true;
        logger.warn("[CHATBOT_RAG] Không gọi được AI, dùng đoạn khớp nhất:", error);
      }
    }
    const answer = grounded ?? (aiFailed ? extractiveAnswer(chunks) : null);
    if (!answer) return null;

    const hasFaq = answer.sourceIds.some((id) => chunks.find((item) => item.chunk.id === id)?.chunk.sourceType === "FAQ");
    return {
      output: {
        reply: answer.reply,
        intent: "GENERAL_HOSPITAL_INFO",
        state: "BOOKING_GUIDE",
        nextStep: "END",
        confidence: Math.min(0.95, 0.6 + (chunks[0].similarity ?? chunks[0].coverage) * 0.35),
        draft: input.draft,
        suggestedActions: knowledgeActions(true),
        sources: toSources(chunks, answer.sourceIds),
      },
      source: grounded ? "AI" : hasFaq ? "FAQ" : "SYSTEM",
      sourceIds: answer.sourceIds,
    };
  }
}

export default new InfoFlow();

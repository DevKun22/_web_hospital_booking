import type { AIChatbotOutput, ChatBookingDraft, ChatbotResponseSource } from "../chatbot.types.js";
import KnowledgeService from "../rag/knowledge.service.js";
import { answerFromSources, extractiveAnswer, type GroundedAnswer } from "../rag/generator.js";
import { logger } from "../../../observability/logger.js";
import { foldVietnamese } from "../rules/text-normalizer.js";
import { TtlCache } from "../rag/ttl-cache.js";
import FollowUp, { withFocus } from "./follow-up.js";
import { vary } from "../rules/variants.js";
import type { ChatbotSource, RetrievedChunk } from "../rag/rag.types.js";
import { loadSourceMeta, sourceMetaKey } from "../rag/source-meta.js";

// Hỏi thông tin (giá, giờ làm việc, chính sách, bác sĩ, quy trình): truy hồi trong kho tri thức rồi để AI trả lời có căn cứ.
// AI không dùng được thì trả nguyên văn đoạn khớp nhất; không có đoạn đủ liên quan thì nói thẳng là chưa có thông tin.

type InfoResult = { output: AIChatbotOutput; source: ChatbotResponseSource; sourceIds: string[] };

const RETRIEVED_LIMIT = 5;

// Câu hỏi thông tin lặp lại (giờ làm việc, giá, chính sách) được trả từ bộ nhớ đệm, khỏi gọi AI; hết hiệu lực khi kho tri thức đồng bộ lại.
const answerCache = new TtlCache<InfoResult>(100, 10 * 60_000);
const cacheKey = (message: string, aiEnabled: boolean, model?: string) => `${aiEnabled ? 1 : 0}|${model ?? ""}|${foldVietnamese(message)}`;

/** Không có thông tin: dẫn người dùng sang việc Kun làm được thay vì dừng ở lời xin lỗi. */
const knowledgeActions = (): AIChatbotOutput["suggestedActions"] => [
  { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
  { type: "CONTACT_STAFF", label: "Hỏi nhân viên hỗ trợ", payload: {} },
];

/** Nhiều đoạn của cùng một bài viết chỉ hiện một nguồn (đoạn đầu tiên được dùng, trỏ đúng mục đó); nguồn là nội dung được duyệt kèm người duyệt và ngày cập nhật. */
const toSources = async (chunks: RetrievedChunk[], ids: string[]): Promise<ChatbotSource[]> => {
  const seen = new Set<string>();
  const picked = ids
    .map((id) => chunks.find((item) => item.chunk.id === id))
    .filter((item): item is RetrievedChunk => Boolean(item))
    .filter((item) => {
      const key = sourceMetaKey({ type: item.chunk.sourceType, sourceId: item.chunk.sourceId });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  // Không tra được thông tin duyệt thì vẫn trả nguồn như cũ: đây chỉ là phần bổ sung, không được làm hỏng câu trả lời.
  const meta = await loadSourceMeta(picked.map((item) => ({ type: item.chunk.sourceType, sourceId: item.chunk.sourceId }))).catch(() => new Map());
  return picked.map((item) => {
    const info = meta.get(sourceMetaKey({ type: item.chunk.sourceType, sourceId: item.chunk.sourceId }));
    return {
      id: item.chunk.id,
      type: item.chunk.sourceType,
      title: item.chunk.title,
      url: item.chunk.url,
      ...(info ? { reviewedBy: info.reviewedBy, updatedAt: info.updatedAt } : {}),
    };
  });
};

/**
 * Câu hỏi nối tiếp rất ngắn ("Dấu hiệu gì?", "Còn trẻ em thì sao?") không tự mang chủ đề. Khi câu trước cũng là câu hỏi thông tin,
 * ghép câu trước vào để truy hồi và AI hiểu đang nói về gì; câu dài đủ ý hoặc đang giữa luồng đặt lịch thì giữ nguyên.
 */
const FOLLOW_UP_MAX_WORDS = 5;
export const withConversationTopic = (message: string, previous: { message: string | null; intent: string | null }) => {
  if (!previous.message || previous.intent !== "GENERAL_HOSPITAL_INFO") return message;
  const words = message.trim().split(/\s+/).filter(Boolean);
  if (words.length > FOLLOW_UP_MAX_WORDS) return message;
  return `${previous.message.trim().replace(/[?!.\s]+$/g, "")}. ${message.trim()}`;
};

/** Nội dung sức khỏe luôn kèm lời nhắc, do mã thêm vào chứ không nhờ AI nhớ. */
const HEALTH_DISCLAIMER = "Đây là thông tin tham khảo, không thay thế tư vấn của bác sĩ.";

/** Hỏi lại đúng câu vừa hỏi mà vẫn chưa có thông tin: nói thẳng và đưa người dùng tới nhân viên, không lặp y nguyên. */
export const noInformationRepeatOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply: "Mình vẫn chưa có thông tin về câu này nên không muốn nói bừa. Bạn thử hỏi cách khác, hoặc nhờ nhân viên hỗ trợ trả lời trực tiếp giúp bạn nhé.",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 0.3,
  draft,
  suggestedActions: [
    { type: "CONTACT_STAFF", label: "Hỏi nhân viên hỗ trợ", payload: {} },
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  ],
});

export const noInformationOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply: vary([
    "Mình chưa tìm thấy thông tin phù hợp về câu này. Mình trả lời tốt nhất về chuyên khoa, bác sĩ, gói khám, giá, giờ làm việc và chính sách đặt lịch, hoặc bạn nhờ nhân viên hỗ trợ nhé.",
    "Câu này nằm ngoài những gì mình có thông tin nên mình không muốn nói bừa. Bạn thử hỏi về chuyên khoa, bác sĩ, gói khám, giá hay cách đặt lịch, hoặc nhờ nhân viên hỗ trợ giúp bạn nhé.",
  ]),
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 0.3,
  draft,
  suggestedActions: knowledgeActions(),
});

/** Kết quả một lần nhờ AI sinh câu trả lời: có câu trả lời, AI báo không đủ căn cứ (grounded null), hoặc không gọi được AI (failed). */
export type Generation = { grounded: GroundedAnswer | null; failed: boolean };

class InfoFlow {
  /** Câu trả lời đã có trong bộ nhớ đệm cho đúng câu hỏi này, nếu có. */
  cached(input: { message: string; draft: ChatBookingDraft; aiEnabled: boolean; model?: string }): InfoResult | null {
    const hit = answerCache.get(cacheKey(input.message, input.aiEnabled, input.model), KnowledgeService.version);
    // Câu trả lời nhớ kèm chủ đề (bác sĩ, khoa, gói) để câu hỏi kế tiếp hiểu "bác sĩ này".
    return hit ? { ...hit, output: { ...hit.output, draft: withFocus(input.draft, hit.output.draft.focus) } } : null;
  }

  /** Truy hồi các đoạn tri thức cho câu hỏi; tách riêng để chạy song song với việc AI phân tích ý định. */
  retrieve(message: string) {
    return KnowledgeService.retrieve(message, { limit: RETRIEVED_LIMIT });
  }

  /**
   * Nhờ AI sinh câu trả lời từ các đoạn tìm được. Không bao giờ ném lỗi (lỗi thành `failed`), để có thể bắt đầu sớm,
   * chạy song song với việc AI phân tích ý định, và bỏ kết quả đi nếu câu hóa ra không phải câu hỏi thông tin.
   */
  generate(input: { message: string; chunks: RetrievedChunk[]; model?: string }): Promise<Generation> {
    return answerFromSources({ question: input.message, chunks: input.chunks, model: input.model })
      .then((grounded) => ({ grounded, failed: false }))
      .catch((error) => {
        logger.warn("[CHATBOT_RAG] Không gọi được AI, dùng đoạn khớp nhất:", error);
        return { grounded: null, failed: true };
      });
  }

  /**
   * Trả lời một câu hỏi thông tin; null khi kho không có đoạn nào liên quan. `chunks` có sẵn thì khỏi truy hồi lại;
   * `generation` có sẵn (đã bắt đầu từ trước) thì chờ nó thay vì gọi AI lần nữa.
   */
  async answer(input: {
    message: string;
    draft: ChatBookingDraft;
    aiEnabled: boolean;
    model?: string;
    chunks?: RetrievedChunk[] | null;
    generation?: Promise<Generation | null> | null;
  }): Promise<InfoResult | null> {
    const version = KnowledgeService.version;
    const chunks = input.chunks ?? (await this.retrieve(input.message));
    if (!chunks.length) return null;

    // AI trả lời "không đủ căn cứ" thì tôn trọng; chỉ khi AI tắt hoặc không gọi được mới trả nguyên văn đoạn khớp nhất.
    let grounded: GroundedAnswer | null = null;
    let aiFailed = !input.aiEnabled;
    if (input.generation) {
      const generation = await input.generation;
      if (generation) {
        grounded = generation.grounded;
        aiFailed = generation.failed;
      }
    } else if (input.aiEnabled) {
      const generation = await this.generate({ message: input.message, chunks, model: input.model });
      grounded = generation.grounded;
      aiFailed = generation.failed;
    }
    const answer = grounded ?? (aiFailed ? extractiveAnswer(chunks) : null);
    if (!answer) return null;

    const usedChunks = chunks.filter((item) => answer.sourceIds.includes(item.chunk.id)).map((item) => item.chunk);
    const followUp = await FollowUp.forChunks(usedChunks);
    const usedTypes = usedChunks.map((chunk) => chunk.sourceType);
    const hasFaq = usedTypes.includes("FAQ");
    const reply = usedTypes.includes("ARTICLE") && !answer.reply.includes(HEALTH_DISCLAIMER) ? `${answer.reply} ${HEALTH_DISCLAIMER}` : answer.reply;
    const result: InfoResult = {
      output: {
        reply,
        intent: "GENERAL_HOSPITAL_INFO",
        state: "BOOKING_GUIDE",
        nextStep: "END",
        confidence: Math.min(0.95, 0.6 + (chunks[0].similarity ?? chunks[0].coverage) * 0.35),
        draft: withFocus(input.draft, followUp.focus),
        suggestedActions: followUp.actions,
        sources: await toSources(chunks, answer.sourceIds),
      },
      source: grounded ? "AI" : hasFaq ? "FAQ" : "SYSTEM",
      sourceIds: answer.sourceIds,
    };
    // Chỉ nhớ câu trả lời do AI sinh (đường lùi rẻ sẵn); phiên bản kho đã đổi giữa chừng thì không nhớ.
    if (grounded && version === KnowledgeService.version) {
      answerCache.set(cacheKey(input.message, input.aiEnabled, input.model), result, version);
    }
    return result;
  }
}

export default new InfoFlow();

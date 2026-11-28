import type { AIChatbotOutput, ChatBookingDraft, ChatbotResponseSource } from "../chatbot.types.js";
import KnowledgeService from "../rag/knowledge.service.js";
import { answerFromSources, extractiveAnswer, numbersAreGrounded, type GroundedAnswer } from "../rag/generator.js";
import { logger } from "../../../observability/logger.js";
import { foldVietnamese } from "../rules/text-normalizer.js";
import { TtlCache } from "../../../utils/ttlCache.js";
import FollowUp, { withFocus } from "./follow-up.js";
import { vary } from "../rules/variants.js";
import type { ChatbotSource, RetrievedChunk } from "../rag/rag.types.js";
import { loadSourceMeta, sourceMetaKey } from "../rag/source-meta.js";

// Hỏi thông tin (giá, giờ làm việc, chính sách, bác sĩ, quy trình): truy hồi trong kho tri thức rồi để AI trả lời có căn cứ.
// AI không dùng được thì trả nguyên văn đoạn khớp nhất; không có đoạn đủ liên quan thì nói thẳng là chưa có thông tin.

/** Điểm truy hồi của từng đoạn, ghi vào vết để soi vì sao câu trả lời dựa vào đoạn đó. */
export type RetrievalTrace = { id: string; type: string; score: number; coverage: number; similarity: number | null };

/** Có đoạn tri thức gần nghĩa nhưng không có câu trả lời kiểm chứng được: giữ vết truy hồi và vài câu hỏi gần nhất để người dùng bấm tiếp. */
export type InfoNoAnswer = {
  noAnswer: true;
  retrieval: RetrievalTrace[];
  nearby: AIChatbotOutput["suggestedActions"];
  ai: { called: boolean; ok: boolean; ms: number } | null;
  numericRejected: boolean;
};

type InfoResult = {
  output: AIChatbotOutput;
  source: ChatbotResponseSource;
  sourceIds: string[];
  retrieval: RetrievalTrace[];
  /** Có gọi AI sinh câu trả lời và AI có trả lời được không. */
  ai: { called: boolean; ok: boolean; ms: number } | null;
  /** Câu trả lời AI bị bỏ vì có con số không có trong nguồn. */
  numericRejected?: boolean;
};

const toRetrievalTrace = (chunks: RetrievedChunk[]): RetrievalTrace[] =>
  chunks.map((item) => ({
    id: item.chunk.id,
    type: item.chunk.sourceType,
    score: Number(item.score.toFixed(5)),
    coverage: Number(item.coverage.toFixed(3)),
    similarity: item.similarity === null ? null : Number(item.similarity.toFixed(3)),
  }));

const RETRIEVED_LIMIT = 5;

const NEARBY_MAX = 2;
const NEARBY_MIN_COVERAGE = 0.34;
const NEARBY_MIN_SIMILARITY = 0.55;
const NEARBY_LABEL_MAX = 44;

/**
 * Chưa trả lời được thì gợi ý các câu hỏi thường gặp gần nghĩa nhất (tiêu đề đoạn FAQ chính là câu hỏi), để người dùng bấm hỏi tiếp
 * thay vì tự đoán cách diễn đạt khác. Chỉ lấy đoạn đủ gần để không gợi ý lạc đề.
 */
export const nearbyQuestionActions = (chunks: RetrievedChunk[]): AIChatbotOutput["suggestedActions"] =>
  chunks
    .filter((item) => item.chunk.sourceType === "FAQ" && (item.coverage >= NEARBY_MIN_COVERAGE || (item.similarity ?? 0) >= NEARBY_MIN_SIMILARITY))
    .slice(0, NEARBY_MAX)
    .map((item) => {
      const title = item.chunk.title.trim();
      const label = title.length > NEARBY_LABEL_MAX ? `${title.slice(0, NEARBY_LABEL_MAX - 1).trimEnd()}…` : title;
      return { type: "ASK_QUESTION" as const, label, payload: { question: title } };
    });

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

const NO_INFORMATION_REPLIES = [
  "Mình chưa tìm thấy thông tin phù hợp về câu này. Mình trả lời tốt nhất về chuyên khoa, bác sĩ, gói khám, giá, giờ làm việc và chính sách đặt lịch, hoặc bạn nhờ nhân viên hỗ trợ nhé.",
  "Câu này nằm ngoài những gì mình có thông tin nên mình không muốn nói bừa. Bạn thử hỏi về chuyên khoa, bác sĩ, gói khám, giá hay cách đặt lịch, hoặc nhờ nhân viên hỗ trợ giúp bạn nhé.",
];

// Có câu hỏi thường gặp gần nghĩa: nói thẳng là chưa có đúng câu trả lời và chỉ ra câu gần nhất để bấm.
const NO_INFORMATION_WITH_NEARBY = [
  "Mình chưa có thông tin đúng với câu này nên không muốn nói bừa. Có thể bạn muốn hỏi một trong các câu bên dưới, hoặc bạn nhờ nhân viên hỗ trợ nhé.",
  "Mình chưa tìm thấy câu trả lời chính xác cho điều bạn hỏi. Bạn xem thử các câu gần nghĩa bên dưới, hoặc nhờ nhân viên hỗ trợ giúp bạn nhé.",
];

export const noInformationOutput = (draft: ChatBookingDraft, nearby: AIChatbotOutput["suggestedActions"] = []): AIChatbotOutput => ({
  reply: vary(nearby.length ? NO_INFORMATION_WITH_NEARBY : NO_INFORMATION_REPLIES),
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 0.3,
  draft,
  suggestedActions: [...nearby, ...knowledgeActions()].slice(0, 4),
});

/** Câu trả lời cuối là "chưa có thông tin" (đường lùi hoặc hệ thống không có căn cứ): dùng để đo tỉ lệ kho tri thức chưa đáp ứng được. */
export const isNoInformationOutput = (output: AIChatbotOutput, source: ChatbotResponseSource) =>
  source === "FALLBACK" ||
  (source === "SYSTEM" && output.intent === "GENERAL_HOSPITAL_INFO" && output.confidence <= 0.3 && !output.sources?.length);

class InfoFlow {
  /** Câu trả lời đã có trong bộ nhớ đệm cho đúng câu hỏi này, nếu có. */
  cached(input: { message: string; draft: ChatBookingDraft; aiEnabled: boolean; model?: string }): InfoResult | null {
    const hit = answerCache.get(cacheKey(input.message, input.aiEnabled, input.model), KnowledgeService.version);
    // Câu trả lời nhớ kèm chủ đề (bác sĩ, khoa, gói) để câu hỏi kế tiếp hiểu "bác sĩ này".
    return hit ? { ...hit, output: { ...hit.output, draft: withFocus(input.draft, hit.output.draft.focus) } } : null;
  }

  /** Truy hồi các đoạn tri thức cho câu hỏi. */
  retrieve(message: string) {
    return KnowledgeService.retrieve(message, { limit: RETRIEVED_LIMIT });
  }

  /**
   * Trả lời một câu hỏi thông tin; null khi kho không có đoạn nào liên quan hoặc không có câu trả lời kiểm chứng được.
   * Chỉ chạy khi bộ điều phối đã xác định đây là câu hỏi thông tin (không sinh trước "phòng hờ" song song với phân tích ý định).
   */
  async answer(input: { message: string; draft: ChatBookingDraft; aiEnabled: boolean; model?: string }): Promise<InfoResult | InfoNoAnswer | null> {
    const version = KnowledgeService.version;
    const chunks = await this.retrieve(input.message);
    if (!chunks.length) return null;
    const retrieval = toRetrievalTrace(chunks);

    // AI trả lời "không đủ căn cứ" thì tôn trọng; chỉ khi AI tắt hoặc không gọi được mới trả nguyên văn đoạn khớp nhất.
    let grounded: GroundedAnswer | null = null;
    let aiFailed = !input.aiEnabled;
    let ai: InfoResult["ai"] = null;
    let numericRejected = false;
    if (input.aiEnabled) {
      const startedAt = Date.now();
      try {
        grounded = await answerFromSources({ question: input.message, chunks, model: input.model });
        ai = { called: true, ok: true, ms: Date.now() - startedAt };
      } catch (error) {
        logger.warn("[CHATBOT_RAG] Không gọi được AI, dùng đoạn khớp nhất:", error instanceof Error ? error.message : "lỗi không rõ");
        aiFailed = true;
        ai = { called: true, ok: false, ms: Date.now() - startedAt };
      }
      // Kiểm số liệu: câu trả lời có con số không nằm trong đoạn nguồn đã dẫn thì bỏ, chuyển sang trích nguyên văn.
      if (grounded) {
        const cited = chunks.filter((item) => grounded!.sourceIds.includes(item.chunk.id)).map((item) => `${item.chunk.title} ${item.chunk.content}`);
        if (!numbersAreGrounded(grounded.reply, cited)) {
          logger.warn("[CHATBOT_RAG] Câu trả lời của AI có số liệu không có trong nguồn, bỏ.");
          grounded = null;
          aiFailed = true;
          numericRejected = true;
        }
      }
    }
    const answer = grounded ?? (aiFailed ? extractiveAnswer(chunks) : null);
    if (!answer) return { noAnswer: true, retrieval, nearby: nearbyQuestionActions(chunks), ai, numericRejected };

    const usedChunks = chunks.filter((item) => answer.sourceIds.includes(item.chunk.id)).map((item) => item.chunk);
    const followUp = await FollowUp.forChunks(usedChunks, input.message);
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
      retrieval,
      ai,
      numericRejected,
    };
    // Chỉ nhớ câu trả lời do AI sinh đã qua kiểm số liệu (đường lùi rẻ sẵn); phiên bản kho đã đổi giữa chừng thì không nhớ.
    if (grounded && version === KnowledgeService.version) {
      answerCache.set(cacheKey(input.message, input.aiEnabled, input.model), result, version);
    }
    return result;
  }
}

export default new InfoFlow();

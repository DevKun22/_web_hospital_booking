import { z } from "zod";
import geminiAdapter from "../ai/gemini.adapter.js";
import type { GenerateReplyInput } from "../ai/ai.adapter.js";
import { logger } from "../../../observability/logger.js";
import type { RetrievedChunk } from "./rag.types.js";

// Bước "sinh" của RAG: AI chỉ được diễn đạt từ các đoạn đã truy hồi và phải nói rõ đã dùng đoạn nào.
// Máy chủ kiểm tra lại nguồn AI nêu; không hợp lệ thì bỏ câu trả lời thay vì tin vào AI.

type Generate = (input: GenerateReplyInput) => Promise<string>;
export type GroundedAnswer = { reply: string; sourceIds: string[] };

const MAX_CHUNK_CHARS = 1200;
const MAX_REPLY_CHARS = 900;

const answerSchema = z.object({
  answerable: z.boolean(),
  reply: z.string().trim().max(MAX_REPLY_CHARS).default(""),
  sources: z.array(z.string()).max(8).default([]),
});

const parseJson = (text: string) =>
  JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()) as unknown;

const answerSystemPrompt = `
Bạn là Kun, trợ lý ảo thân thiện của cơ sở khám DevKunCare. Xưng "mình", gọi người dùng là "bạn". Trả lời câu hỏi bằng tiếng Việt, chỉ dựa trên các đoạn trong SOURCES.

Quy tắc bắt buộc:
- Không dùng kiến thức ngoài SOURCES. Không tự thêm giá, giờ làm việc, tên bác sĩ, chính sách hay số điện thoại.
- Nếu SOURCES không đủ để trả lời, đặt answerable=false và để reply rỗng.
- Không chẩn đoán, không kê thuốc, không nêu liều thuốc, không tư vấn điều trị. Với nội dung sức khỏe, nhắc bạn đi khám khi có dấu hiệu nặng hoặc kéo dài.
- Viết ngắn gọn, ấm áp, tối đa 4 câu, không dùng Markdown hay danh sách.
- Nếu người dùng so sánh hai bác sĩ, hai gói khám hay hai chuyên khoa, nêu điểm khác nhau chính có trong SOURCES (giá, hạng mục, chuyên môn) và không phán đoán bên nào tốt hơn.
- Nếu câu hỏi nêu một nhóm người (trẻ em, người cao tuổi, phụ nữ mang thai), chỉ nêu điều SOURCES có nói về nhóm đó.
- "Giờ làm việc/giờ mở cửa" (thông tin liên hệ) khác "lịch khám có thể đặt online" (ca của bác sĩ): hỏi ngày nào khám được hay đặt lịch được thì dựa vào đoạn lịch khám; hai nguồn khác nhau thì nêu cả hai, không tự gộp.
- Không bao giờ nói còn hay hết lịch trống ở một giờ cụ thể, và không nói đã giữ chỗ hay đã đặt lịch cho người dùng.
- Mỗi thông tin nêu ra phải có trong ít nhất một đoạn; liệt kê mã các đoạn đã dùng ở "sources" (ví dụ ["S1","S3"]).
- Chỉ trả JSON hợp lệ: {"answerable":true|false,"reply":"...","sources":["S1"]}.
`;

const label = (index: number) => `S${index + 1}`;

/** Sinh câu trả lời có căn cứ; null nếu AI báo không đủ thông tin hoặc nêu nguồn không có trong kết quả truy hồi. Ném lỗi nếu không gọi được AI. */
export const answerFromSources = async (input: {
  question: string;
  chunks: RetrievedChunk[];
  model?: string;
  generate?: Generate;
}): Promise<GroundedAnswer | null> => {
  if (!input.chunks.length) return null;
  const generate = input.generate ?? ((request) => geminiAdapter.generateReply(request));
  const sources = input.chunks
    .map((item, index) => `[${label(index)}] ${item.chunk.title}\n${item.chunk.content.slice(0, MAX_CHUNK_CHARS)}`)
    .join("\n\n");

  // Lỗi gọi AI (hết hạn, mất mạng) được ném ra để bên gọi chuyển sang đường lùi; kết quả không dùng được thì trả null.
  const text = await generate({
    systemPrompt: answerSystemPrompt,
    userPrompt: `QUESTION: ${JSON.stringify(input.question)}\nSOURCES:\n${sources}`,
    model: input.model,
  });
  try {
    const parsed = answerSchema.parse(parseJson(text));
    if (!parsed.answerable || !parsed.reply) return null;

    const byLabel = new Map(input.chunks.map((item, index) => [label(index), item.chunk.id]));
    const sourceIds = [...new Set(parsed.sources.map((name) => byLabel.get(name)).filter((id): id is string => Boolean(id)))];
    // Câu trả lời không dẫn nguồn hợp lệ nào thì không kiểm chứng được: bỏ.
    if (!sourceIds.length || sourceIds.length !== new Set(parsed.sources).size) return null;
    return { reply: parsed.reply, sourceIds };
  } catch (error) {
    logger.warn("[CHATBOT_RAG] Phản hồi của AI không đúng định dạng, bỏ qua:", error);
    return null;
  }
};

/** Bỏ dấu phân cách hàng nghìn ("1.250.000" → "1250000") để cùng một số viết hai kiểu vẫn so khớp được. */
const withoutThousands = (text: string) => text.replace(/(\d)[.,](?=\d{3}\b)/g, "$1");

/**
 * Số cần kiểm trong câu trả lời: mọi số từ 2 chữ số, và số MỘT chữ số đi với đơn vị (2 giờ, 7h, 7:00, 3 ngày, 5%) vì đó
 * thường là chính sách hoặc giờ giấc. Số một chữ số đứng riêng ("có 2 cách") không kiểm để tránh bỏ nhầm câu trả lời đúng.
 */
const factNumbersIn = (text: string) => {
  const normalized = withoutThousands(text);
  const multiDigit = normalized.match(/\d{2,}/g) ?? [];
  const unitDigits = [...normalized.matchAll(/(?<![\d.,])(\d)(?=\s*(?:giờ|tiếng|phút|ngày|tuần|tháng|năm|lần|tuổi|buổi|%|h(?![\p{L}])|:\d{2}))/giu)].map(
    (match) => match[1],
  );
  return [...multiDigit, ...unitDigits];
};

/**
 * Kiểm số liệu của câu trả lời: mọi con số mang thông tin (giá, giờ, số điện thoại, số ngày, số giờ khóa hủy) phải xuất hiện
 * trong các đoạn nguồn đã dùng. AI diễn đạt đúng ý nhưng tự đổi một con số là lỗi nguy hiểm nhất của RAG ở đây, nên câu trả lời
 * có số lạ bị bỏ. Lưu ý: nguồn hợp lệ chỉ chứng minh AI đã dẫn đúng đoạn, không chứng minh mọi câu chữ khác là đúng.
 */
export const numbersAreGrounded = (reply: string, sources: string[]) => {
  // So theo giá trị, bỏ số 0 đứng đầu: "07:00" trong câu trả lời khớp "7:00" trong nguồn.
  const canonical = (value: string) => value.replace(/^0+(?=\d)/, "");
  const known = new Set(sources.flatMap((source) => (withoutThousands(source).match(/\d+/g) ?? []).map(canonical)));
  return factNumbersIn(reply).every((value) => known.has(canonical(value)));
};

/** Đường lùi chỉ dùng khi đoạn đầu khớp rất rõ (phủ phần lớn từ khóa hoặc rất gần về ý nghĩa): trả lời sai còn tệ hơn nói chưa có thông tin. */
const EXTRACTIVE_MIN_COVERAGE = 0.7;
const EXTRACTIVE_MIN_SIMILARITY = 0.75;

/** Đường lùi khi AI không dùng được: trả nguyên văn đoạn khớp nhất (câu trả lời của FAQ, hoặc nội dung đoạn). */
export const extractiveAnswer = (chunks: RetrievedChunk[]): GroundedAnswer | null => {
  const top = chunks[0];
  if (!top || (top.coverage < EXTRACTIVE_MIN_COVERAGE && (top.similarity ?? 0) < EXTRACTIVE_MIN_SIMILARITY)) return null;
  const answerMatch = top.chunk.content.match(/Trả lời:\s*([\s\S]+)$/);
  const text = (answerMatch ? answerMatch[1] : top.chunk.content).replace(/\s*\n\s*/g, " ").trim();
  // Gợi ý chuyên khoa là định hướng ban đầu, không phải chẩn đoán.
  const note = top.chunk.sourceType === "DEPARTMENT" ? " Đây là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ." : "";
  const reply = `${text.slice(0, MAX_REPLY_CHARS - note.length)}${note}`.trim();
  return reply ? { reply, sourceIds: [top.chunk.id] } : null;
};

// ---- Diễn đạt gợi ý chuyên khoa ----

const triageSchema = z.object({ reply: z.string().trim().min(20).max(MAX_REPLY_CHARS) });

const triageSystemPrompt = `
Bạn là Kun, trợ lý ảo thân thiện của cơ sở khám DevKunCare. Xưng "mình", gọi người dùng là "bạn". Diễn đạt câu trả lời tự nhiên bằng tiếng Việt, chỉ dựa trên VERIFIED_DATA.

Quy tắc bắt buộc:
- Không chẩn đoán và không khẳng định chuyên khoa là lựa chọn duy nhất.
- Không tạo thêm chuyên khoa, bác sĩ, giá hay lịch ngoài VERIFIED_DATA.
- Không nhắc JSON, database, điểm số, từ khóa hay mô hình AI.
- Giọng bình tĩnh, ấm áp, tôn trọng. Viết tối đa 3 câu, không dùng danh sách hay Markdown.
- Nếu matched=true, dùng đúng tên chuyên khoa và nói đây là gợi ý để thăm khám ban đầu.
- Nếu fallback=true, nói rõ chưa đủ dữ liệu để gợi ý chuyên khoa cụ thể và đây là nơi đánh giá ban đầu.
- Kết thúc bằng lưu ý đây là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ.
- Chỉ trả JSON hợp lệ: {"reply":"..."}.
`;

export const composeTriageReply = async (input: {
  userMessage: string;
  verifiedData: Record<string, unknown>;
  departmentName: string;
  fallbackReply: string;
  model?: string;
  generate?: Generate;
}): Promise<string> => {
  const generate = input.generate ?? ((request) => geminiAdapter.generateReply(request));
  try {
    const text = await generate({
      systemPrompt: triageSystemPrompt,
      userPrompt: `USER_MESSAGE: ${JSON.stringify(input.userMessage)}\nVERIFIED_DATA: ${JSON.stringify(input.verifiedData)}`,
      model: input.model,
    });
    const parsed = triageSchema.parse(parseJson(text));
    // Gợi ý phải giữ nguyên tên chuyên khoa lấy từ DB.
    return parsed.reply.includes(input.departmentName) ? parsed.reply : input.fallbackReply;
  } catch (error) {
    logger.warn("[CHATBOT_RAG] Không diễn đạt được gợi ý chuyên khoa bằng AI, dùng mẫu dự phòng:", error);
    return input.fallbackReply;
  }
};

// ---- Tóm tắt một bài viết ----

const MAX_ARTICLE_CHARS = 6000;
const MAX_SUMMARY_CHARS = 800;

const summarySchema = z.object({ summary: z.string().trim().min(40).max(MAX_SUMMARY_CHARS) });

const summarySystemPrompt = `
Bạn là Kun, trợ lý ảo thân thiện của cơ sở khám DevKunCare. Xưng "mình", gọi người dùng là "bạn". Tóm tắt bài viết trong ARTICLE bằng tiếng Việt cho người không chuyên.

Quy tắc bắt buộc:
- Chỉ dùng nội dung trong ARTICLE. Không thêm kiến thức ngoài, không thêm con số, liều thuốc, tên thuốc hay lời khuyên điều trị không có trong bài.
- Viết 3 đến 5 ý ngắn, mỗi ý một dòng bắt đầu bằng "• ". Không dùng Markdown khác, không tiêu đề.
- Giữ đúng ý chính của bài, nhắc dấu hiệu cần đi khám nếu bài có nói.
- Chỉ trả JSON hợp lệ: {"summary":"..."}.
`;

/** Mọi con số (từ 2 chữ số) trong bản tóm tắt phải có trong bài: chặn việc AI tự thêm số liệu. */
export const numbersAreFromArticle = (summary: string, article: string) =>
  (summary.match(/\d{2,}/g) ?? []).every((value) => article.includes(value));

/** Tóm tắt bài viết bằng AI; null nếu kết quả không đúng định dạng hoặc có số liệu không có trong bài. Ném lỗi nếu không gọi được AI. */
export const summarizeArticleText = async (input: {
  title: string;
  content: string;
  model?: string;
  generate?: Generate;
}): Promise<string | null> => {
  const generate = input.generate ?? ((request) => geminiAdapter.generateReply(request));
  const text = await generate({
    systemPrompt: summarySystemPrompt,
    userPrompt: `ARTICLE_TITLE: ${JSON.stringify(input.title)}\nARTICLE:\n${input.content.slice(0, MAX_ARTICLE_CHARS)}`,
    model: input.model,
  });
  try {
    const { summary } = summarySchema.parse(parseJson(text));
    return numbersAreFromArticle(summary, `${input.title}\n${input.content}`) ? summary : null;
  } catch (error) {
    logger.warn("[CHATBOT_RAG] Bản tóm tắt bài viết của AI không dùng được, dùng đường lùi:", error);
    return null;
  }
};

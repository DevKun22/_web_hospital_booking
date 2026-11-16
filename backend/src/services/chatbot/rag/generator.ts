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
Bạn là trợ lý thông tin của một cơ sở khám bệnh. Trả lời câu hỏi của người dùng bằng tiếng Việt, chỉ dựa trên các đoạn trong SOURCES.

Quy tắc bắt buộc:
- Không dùng kiến thức ngoài SOURCES. Không tự thêm giá, giờ làm việc, tên bác sĩ, chính sách hay số điện thoại.
- Nếu SOURCES không đủ để trả lời, đặt answerable=false và để reply rỗng.
- Không chẩn đoán, không kê thuốc, không tư vấn điều trị.
- Gọi người dùng là "bạn", viết ngắn gọn, tối đa 4 câu, không dùng Markdown hay danh sách.
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

/** Đường lùi khi AI không dùng được: trả nguyên văn đoạn khớp nhất (câu trả lời của FAQ, hoặc nội dung đoạn). */
export const extractiveAnswer = (chunks: RetrievedChunk[]): GroundedAnswer | null => {
  const top = chunks[0];
  if (!top) return null;
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
Bạn là trợ lý điều hướng khám của cơ sở khám. Diễn đạt câu trả lời tự nhiên bằng tiếng Việt, chỉ dựa trên VERIFIED_DATA.

Quy tắc bắt buộc:
- Không chẩn đoán và không khẳng định chuyên khoa là lựa chọn duy nhất.
- Không tạo thêm chuyên khoa, bác sĩ, giá hay lịch ngoài VERIFIED_DATA.
- Không nhắc JSON, database, điểm số, từ khóa hay mô hình AI.
- Gọi người dùng là "bạn", giọng bình tĩnh, tôn trọng. Viết tối đa 3 câu, không dùng danh sách hay Markdown.
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

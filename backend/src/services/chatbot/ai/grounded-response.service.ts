import { z } from "zod";
import type { NLUResult } from "./nlu.schema.js";
import geminiAdapter from "./gemini.adapter.js";
import type { TriageRecommendation } from "../retrieval/triage.repository.js";

type GroundedTriageInput = {
  userMessage: string;
  nlu: NLUResult;
  recommendation: TriageRecommendation;
  fallbackReply: string;
  model?: string;
};

const groundedReplySchema = z.object({
  reply: z.string().trim().min(20).max(900),
});

const parseJson = (text: string) =>
  JSON.parse(
    text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim(),
  ) as unknown;

const systemPrompt = `
Bạn là trợ lý điều hướng khám của cơ sở khám.
Hãy diễn đạt câu trả lời tự nhiên bằng tiếng Việt dựa duy nhất trên VERIFIED_DATA.

Quy tắc bắt buộc:
- Không chẩn đoán và không khẳng định chắc chắn chuyên khoa là lựa chọn duy nhất.
- Không tạo thêm chuyên khoa, bác sĩ, giá, lịch khám hoặc thông tin ngoài VERIFIED_DATA.
- Không nhắc đến JSON, database, điểm số, từ khóa, mô hình AI hoặc cụm "người dùng mô tả".
- Không lặp nguyên văn toàn bộ câu hỏi và không dùng lời mở đầu máy móc như "Tôi hiểu bạn đang gặp".
- Gọi người dùng là "bạn", giọng điệu bình tĩnh, tôn trọng và dễ hiểu.
- Nếu matched=true, dùng tên chuyên khoa chính xác và nói đây là gợi ý để thăm khám ban đầu.
- Nếu fallback=true, nói rõ hệ thống chưa đủ dữ liệu để gợi ý chuyên khoa cụ thể và đây là nơi đánh giá ban đầu.
- Chỉ thêm khuyến cáo cấp cứu ngắn khi triệu chứng có mức độ nặng hoặc có dấu hiệu nguy hiểm trong dữ liệu.
- Kết thúc bằng lưu ý đây là gợi ý định hướng, không thay thế chẩn đoán của bác sĩ.
- Viết tối đa 3 câu, không dùng danh sách hoặc Markdown.
- Chỉ trả JSON hợp lệ theo dạng {"reply":"..."}.
`;

class GroundedResponseService {
  async composeTriageReply(input: GroundedTriageInput): Promise<string> {
    const verifiedData = {
      department: {
        name: input.recommendation.departmentName,
        description:
          input.recommendation.triageDescription ||
          input.recommendation.description,
      },
      matched: input.recommendation.matched,
      fallback: input.recommendation.fallback,
      symptoms: input.nlu.entities.symptoms,
      bodyParts: input.nlu.entities.bodyParts,
      duration: input.nlu.entities.duration,
      severity: input.nlu.entities.severity,
      associatedSymptoms: input.nlu.entities.associatedSymptoms,
    };

    try {
      const text = await geminiAdapter.generateReply({
        systemPrompt,
        userPrompt: [
          `USER_MESSAGE: ${JSON.stringify(input.userMessage)}`,
          `VERIFIED_DATA: ${JSON.stringify(verifiedData)}`,
        ].join("\n"),
        model: input.model,
      });
      const parsed = groundedReplySchema.parse(parseJson(text));

      // A grounded recommendation must keep the exact database entity visible.
      if (!parsed.reply.includes(input.recommendation.departmentName)) {
        return input.fallbackReply;
      }

      return parsed.reply;
    } catch (error) {
      console.warn(
        "[CHATBOT] Không thể diễn đạt phản hồi phân luồng bằng AI, sử dụng mẫu dự phòng",
        error,
      );
      return input.fallbackReply;
    }
  }
}

export default new GroundedResponseService();
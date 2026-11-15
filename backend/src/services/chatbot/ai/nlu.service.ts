import geminiAdapter from "./gemini.adapter.js";
import { nluResultSchema, type NLUResult } from "./nlu.schema.js";
import type { ChatBookingDraft } from "../chatbot.types.js";

export type NLUCatalog = {
  departments: string[];
  packages: string[];
  doctors: string[];
};

type ExtractInput = {
  message: string;
  draft: ChatBookingDraft;
  catalog: NLUCatalog;
  model?: string;
};

const systemPrompt = `
Bạn là bộ phân tích ngôn ngữ cho hệ thống đặt lịch khám.
Chỉ trích xuất ý định và thực thể từ câu người dùng, không trả lời hội thoại.
Không tạo ID, giá, bác sĩ, gói khám hoặc lịch trống.
Tên thực thể chỉ được chọn từ CANDIDATE_CATALOG khi có đối tượng phù hợp rõ ràng.
Ngày phải ở định dạng YYYY-MM-DD. Dùng múi giờ Asia/Ho_Chi_Minh.
Nếu người dùng hỏi chatbot có thể làm gì hoặc hỗ trợ gì, dùng operation=ASK_CAPABILITIES.
Nếu người dùng hỏi kiến thức chung hoặc nội dung ngoài nghiệp vụ cơ sở khám, dùng operation=ASK_INFORMATION.
Nếu người dùng mô tả triệu chứng, trích xuất triệu chứng, vị trí cơ thể, thời gian, mức độ và triệu chứng đi kèm. Dùng operation=SEARCH_DEPARTMENT.
Không chẩn đoán. Không tự chọn chuyên khoa bằng kiến thức riêng; chỉ nhận departmentName khi người dùng nhắc rõ tên khoa.
Với triệu chứng còn thiếu thông tin, tạo đúng một clarificationQuestion ngắn, tự nhiên và không lặp CURRENT_DRAFT.triageLastQuestion.
Nếu người dùng sửa lựa chọn, điền các trường cần xóa vào correction.clearFields.
Chỉ trả JSON hợp lệ, không markdown.
`;

const parseJson = (text: string) =>
  JSON.parse(
    text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim(),
  ) as unknown;

class ChatbotNLUService {
  async extract(input: ExtractInput): Promise<NLUResult> {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const userPrompt = [
      `CURRENT_DATE: ${today}`,
      `CURRENT_DRAFT: ${JSON.stringify(input.draft)}`,
      `CANDIDATE_CATALOG: ${JSON.stringify(input.catalog)}`,
      `USER_MESSAGE: ${input.message}`,
      "OUTPUT_SCHEMA:",
      JSON.stringify({
        operation:
          "SEARCH_DEPARTMENT | SEARCH_PACKAGE | SEARCH_DOCTOR | SEARCH_SLOT | START_BOOKING | LOOKUP_APPOINTMENT | ASK_PAYMENT | ASK_INFORMATION | ASK_CAPABILITIES | CHANGE_SELECTION | RESET_FLOW | GREETING | UNKNOWN",
        entities: {
          departmentName: null,
          packageName: null,
          doctorName: null,
          date: null,
          timePeriod: null,
          symptoms: [],
          bodyParts: [],
          duration: null,
          severity: null,
          associatedSymptoms: [],
          reason: null,
        },
        triage: {
          summary: null,
          clarificationQuestion: null,
          missingDetails: [],
        },
        correction: { clearFields: [] },
        confidence: 0,
      }),
    ].join("\n");

    const text = await geminiAdapter.generateReply({
      systemPrompt,
      userPrompt,
      model: input.model,
    });

    return nluResultSchema.parse(parseJson(text));
  }
}

export default new ChatbotNLUService();
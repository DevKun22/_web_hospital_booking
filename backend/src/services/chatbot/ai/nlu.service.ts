import geminiAdapter from "./gemini.adapter.js";
import { nluResultSchema, type NLUResult } from "./nlu.schema.js";
import type { ChatBookingDraft } from "../chatbot.types.js";
import { CHAT_OPERATIONS } from "../chatbot.types.js";
import { intentPromptSection } from "../intent/intent.spec.js";

export type NLUCatalog = {
  departments: string[];
  packages: string[];
  doctors: string[];
};

/** Một lượt gần đây gửi cho AI để hiểu câu nối tiếp: chỉ tin người dùng đã che thông tin cá nhân và ý định đã xử lý. */
export type NLUHistoryTurn = { user: string; operation: string | null };

type ExtractInput = {
  message: string;
  draft: ChatBookingDraft;
  catalog: NLUCatalog;
  history?: NLUHistoryTurn[];
  /** Trạng thái luồng hiện tại (ví dụ CHOOSING_SLOT), để hiểu câu ngắn như "9 giờ được không". */
  state?: string | null;
  model?: string;
};

const systemPrompt = `
Bạn là bộ phân tích ngôn ngữ cho hệ thống đặt lịch khám DevKunCare.
Chỉ trích xuất ý định và thực thể từ USER_MESSAGE, không trả lời hội thoại.
Dùng RECENT_TURNS và CURRENT_STATE để hiểu câu nối tiếp ngắn ("còn chiều thì sao", "bác sĩ đó"), nhưng ý định là của USER_MESSAGE.
Không tạo ID, giá, bác sĩ, gói khám, lịch trống hay mã lịch hẹn.
Tên thực thể chỉ được chọn từ CANDIDATE_CATALOG khi có đối tượng phù hợp rõ ràng.
Ngày phải ở định dạng YYYY-MM-DD, giờ ở dạng HH:mm 24 giờ. Dùng múi giờ Asia/Ho_Chi_Minh. Không nêu ngày giờ thì để null.

Các ý định (operation):
${intentPromptSection()}

Nếu câu có hai yêu cầu khác nhau, operation là yêu cầu chính, secondaryOperation là yêu cầu còn lại; chỉ có một thì để null.
Hủy hoặc đổi lịch hẹn ĐÃ ĐẶT là CANCEL_APPOINTMENT hoặc RESCHEDULE_APPOINTMENT; hỏi quy định hủy/đổi lịch nói chung là ASK_POLICY.
Nếu người dùng nhắc tới một lịch hẹn cụ thể (mã đặt lịch, "lịch ngày mai"), ghi nguyên cách nói vào entities.appointmentRef.
Nếu người dùng mô tả triệu chứng, trích xuất triệu chứng, vị trí cơ thể, thời gian, mức độ và triệu chứng đi kèm.
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

const MAX_HISTORY_TURNS = 5;

/** Bản nháp gửi cho AI chỉ gồm việc đã chọn gì (có/không) và triệu chứng; không gửi mã định danh hay lý do khám đầy đủ. */
const nluDraft = (draft: ChatBookingDraft) => ({
  hasDepartment: Boolean(draft.departmentId),
  hasPackage: Boolean(draft.packageId),
  hasDoctor: Boolean(draft.doctorId),
  hasSlot: Boolean(draft.timeSlotId),
  date: draft.date ?? null,
  timePeriod: draft.timePeriod ?? null,
  symptoms: draft.symptoms ?? [],
  triageLastQuestion: draft.triageLastQuestion ?? null,
});

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
      `CURRENT_DRAFT: ${JSON.stringify(nluDraft(input.draft))}`,
      `CURRENT_STATE: ${input.state || "IDLE"}`,
      `RECENT_TURNS: ${JSON.stringify((input.history || []).slice(-MAX_HISTORY_TURNS))}`,
      `CANDIDATE_CATALOG: ${JSON.stringify(input.catalog)}`,
      `USER_MESSAGE: ${input.message}`,
      "OUTPUT_SCHEMA:",
      JSON.stringify({
        operation: CHAT_OPERATIONS.join(" | "),
        secondaryOperation: null,
        entities: {
          departmentName: null,
          packageName: null,
          doctorName: null,
          date: null,
          timePeriod: null,
          preferredTime: null,
          appointmentRef: null,
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
import { prisma } from "../../config/prisma.js";
import { logger } from "../../observability/logger.js";
import { AppError } from "../../utils/appError.js";
import ChatbotNLUService from "./ai/nlu.service.js";
import type { NLUResult } from "./ai/nlu.schema.js";
import ChatbotActionService from "./chatbot.actions.js";
import ChatbotContextService from "./chatbot.context.js";
import ChatbotSettingsService from "./chatbot.settings.js";
import BookingFlow from "./flows/booking.flow.js";
import InfoFlow, { noInformationOutput } from "./flows/info.flow.js";
import {
  capabilitiesOutput,
  emergencyOutput,
  fallbackOutput,
  greetingOutput,
  resetOutput,
} from "./flows/system.replies.js";
import TriageFlow from "./flows/triage.flow.js";
import { routeByRules } from "./router/route.js";
import ChatbotEntityResolver from "./retrieval/entity.resolver.js";
import { hasEmergencySignal } from "./rules/emergency-detector.js";
import { sanitizeBookingDraft } from "./rules/draft-sanitizer.js";
import { sanitizeReplyText } from "./rules/reply-sanitizer.js";
import { normalizeMessage } from "./rules/text-normalizer.js";
import { getOrCreateChatSession, mergeDrafts, updateChatSession } from "./chatbot.session.js";
import ChatbotDraftReducer from "./workflow/draft.reducer.js";
import { operationFromAction, operationToIntent } from "./workflow/operation.js";
import type {
  AIChatbotOutput,
  ChatBookingDraft,
  ChatOperation,
  ChatbotRequestInput,
  ChatbotResponse,
  ChatbotResponseSource,
} from "./chatbot.types.js";

// Đường đi của một tin nhắn (mỗi bước chỉ chạy khi bước trước chưa trả lời được, bước rẻ đi trước):
//   1. Rào an toàn: dấu hiệu cấp cứu → trả lời khẩn cấp, không qua AI.
//   2. Định tuyến: nút bấm hoặc quy tắc (chào, hỏi chức năng, làm lại) → không tốn AI; còn lại AI phân tích ý định một lần.
//   3. Hỏi thông tin → RAG (truy hồi trong kho tri thức, AI trả lời có căn cứ).
//   4. Gợi ý chuyên khoa theo triệu chứng → truy hồi chuyên khoa; đặt lịch → luồng do máy chủ điều khiển từ dữ liệu DB.

/** Các ý định ưu tiên trả lời bằng kho tri thức; luồng đặt lịch chỉ nhận khi kho không có câu trả lời. */
const INFO_OPERATIONS = new Set<ChatOperation>(["ASK_INFORMATION", "ASK_PAYMENT", "LOOKUP_APPOINTMENT", "UNKNOWN"]);

const emptyNLUResult = (): NLUResult => ({
  operation: "UNKNOWN",
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
  triage: { summary: null, clarificationQuestion: null, missingDetails: [] },
  correction: { clearFields: [] },
  confidence: 0,
});

const hasSelection = (draft: ChatBookingDraft) => Boolean(draft.departmentId || draft.packageId || draft.doctorId || draft.timeSlotId);

class ChatbotService {
  async handleMessage(input: ChatbotRequestInput): Promise<ChatbotResponse> {
    const runtimeSetting = await ChatbotSettingsService.getRuntimeSettings();
    if (!runtimeSetting.isActive) {
      throw new AppError("Chatbot đang tạm tắt. Vui lòng gửi yêu cầu tư vấn để nhân viên hỗ trợ.", 503);
    }

    const settings = runtimeSetting.value;
    const session = await getOrCreateChatSession(input.sessionId, input.phone, settings.sessionExpiresDays);
    const sessionId = session.id;
    const requestDraft = sanitizeBookingDraft(mergeDrafts(session.draft, input.draft));
    const actionDraft = ChatbotDraftReducer.reduceAction(requestDraft, input.action);

    const finish = async (output: AIChatbotOutput, source: ChatbotResponseSource, sourceIds: string[] = []) => {
      const suggestedActions = await ChatbotActionService.validateActions(
        output.suggestedActions,
        output.draft,
        settings.maxSuggestedActions,
      );
      const response: ChatbotResponse = {
        sessionId,
        source,
        ...output,
        reply: sanitizeReplyText(output.reply),
        suggestedActions,
      };
      await Promise.all([
        updateChatSession(sessionId, response, input.message, input.phone, settings.sessionExpiresDays),
        this.saveLog(input, response, sourceIds),
      ]);
      return response;
    };

    // 1. Rào an toàn
    if (hasEmergencySignal(normalizeMessage(input.message))) {
      return finish(emergencyOutput(actionDraft), "EMERGENCY");
    }

    // 2. Định tuyến
    const actionOperation = operationFromAction(input.action);
    const rule = actionOperation ? "NEEDS_NLU" : routeByRules(input.message);
    if (rule === "RESET") return finish(resetOutput(), "SYSTEM");
    if (rule === "GREETING") return finish(greetingOutput(actionDraft), "SYSTEM");
    if (rule === "CAPABILITIES") return finish(capabilitiesOutput(actionDraft), "SYSTEM");

    let nlu = emptyNLUResult();
    let aiUnavailable = false;
    if (actionOperation) {
      nlu.operation = actionOperation;
      nlu.confidence = 1;
    } else if (settings.aiEnabled) {
      try {
        nlu = await ChatbotNLUService.extract({
          message: input.message,
          draft: actionDraft,
          catalog: await ChatbotContextService.loadNLUCatalog(),
          model: settings.model,
        });
      } catch (error) {
        aiUnavailable = true;
        logger.warn("[CHATBOT] Không phân tích được ý định bằng AI, dùng đường lùi:", error);
        if (!settings.fallbackEnabled) {
          throw new AppError(
            error instanceof Error ? `AI không thể phân tích yêu cầu: ${error.message}` : "AI không thể phân tích yêu cầu",
            502,
          );
        }
      }
    } else {
      aiUnavailable = true;
    }

    if (nlu.operation === "RESET_FLOW") return finish(resetOutput(), "SYSTEM");
    if (nlu.operation === "GREETING") return finish(greetingOutput(actionDraft), "SYSTEM");
    if (nlu.operation === "ASK_CAPABILITIES") return finish(capabilitiesOutput(actionDraft), "SYSTEM");

    // Thực thể AI trích ra (tên khoa, bác sĩ, ngày...) được đối chiếu với DB, chỉ giữ phần xác minh được.
    const resolved = actionOperation || nlu.confidence < 0.25 ? { patch: {} } : await ChatbotEntityResolver.resolve(nlu);
    let draft = ChatbotDraftReducer.reduce(actionDraft, resolved.patch, nlu.correction);

    // 3. Hỏi thông tin → RAG. Câu chưa rõ ý (UNKNOWN) khi đang giữa luồng đặt lịch thì để luồng đặt lịch xử lý trước.
    const wantsInfo =
      !actionOperation &&
      settings.faqEnabled &&
      INFO_OPERATIONS.has(nlu.operation) &&
      !(nlu.operation === "UNKNOWN" && hasSelection(draft));
    if (wantsInfo) {
      const info = await InfoFlow.answer({ message: input.message, draft, aiEnabled: settings.aiEnabled && !aiUnavailable, model: settings.model });
      if (info) return finish(info.output, info.source, info.sourceIds);
      if (nlu.operation === "ASK_INFORMATION") return finish(noInformationOutput(draft), "SYSTEM");
    }

    // 4. Gợi ý chuyên khoa theo triệu chứng
    const wantsTriage = !actionOperation && nlu.operation === "SEARCH_DEPARTMENT" && Boolean(draft.symptoms?.length);
    const triage = wantsTriage ? await TriageFlow.recommend(draft) : null;
    if (triage && !resolved.patch.departmentId && (!draft.departmentId || (triage.matched && draft.departmentId !== triage.departmentId))) {
      draft = ChatbotDraftReducer.reduce(
        draft,
        { departmentId: triage.departmentId, departmentSlug: triage.departmentSlug || undefined },
        { clearFields: [] },
      );
    }

    // 5. Luồng đặt lịch: máy chủ quyết định bước tiếp theo và dựng kết quả, nút bấm từ DB.
    const intent = operationToIntent(nlu.operation, draft, nlu);
    const context = await ChatbotContextService.load(intent, draft);
    const output = BookingFlow.resolve({
      message: input.message,
      detectedIntent: intent,
      context,
      draft,
      action: input.action,
      nlu,
      triageRecommendation: triage,
    });
    if (!output) return finish(fallbackOutput(draft, aiUnavailable), "FALLBACK");

    const aiPhrased = intent === "SYMPTOM_TRIAGE" && !actionOperation && !aiUnavailable;
    if (aiPhrased && triage && output.intent === "SYMPTOM_TRIAGE" && output.state === "SUGGESTING_DEPARTMENT") {
      output.reply = await TriageFlow.composeReply({
        userMessage: input.message,
        nlu,
        recommendation: triage,
        fallbackReply: output.reply,
        model: settings.model,
      });
    }
    return finish(output, aiPhrased ? "AI" : "SYSTEM");
  }

  private async saveLog(input: ChatbotRequestInput, response: ChatbotResponse, sourceIds: string[]) {
    await prisma.chatbotLog.create({
      data: {
        guestPhone: input.phone,
        sessionId: response.sessionId,
        message: input.message,
        response: response.reply,
        intent: response.intent,
        sourceIds,
      },
    });
  }
}

export default new ChatbotService();

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/appError.js";
import ChatbotNLUService from "./ai/nlu.service.js";
import GroundedResponseService from "./ai/grounded-response.service.js";
import type { NLUResult } from "./ai/nlu.schema.js";
import ChatbotActionService from "./chatbot.actions.js";
import ChatbotContextService from "./chatbot.context.js";
import ChatbotEntityResolver from "./retrieval/entity.resolver.js";
import ChatbotFAQRepository from "./retrieval/faq.repository.js";
import TriageRepository from "./retrieval/triage.repository.js";
import { composeFAQOutput } from "./chatbot.responses.js";
import ChatbotSettingsService from "./chatbot.settings.js";
import ChatbotWorkflowService from "./chatbot.workflow.js";
import { hasEmergencySignal } from "./rules/emergency-detector.js";
import { normalizeMessage } from "./rules/text-normalizer.js";
import { sanitizeBookingDraft } from "./rules/draft-sanitizer.js";
import {
  getOrCreateChatSession,
  mergeDrafts,
  updateChatSession,
} from "./chatbot.session.js";
import ChatbotDraftReducer from "./workflow/draft.reducer.js";
import {
  operationFromAction,
  operationToIntent,
} from "./workflow/operation.js";
import type {
  AIChatbotOutput,
  ChatBookingDraft,
  ChatbotRequestInput,
  ChatbotResponse,
  ChatbotResponseSource,
} from "./chatbot.types.js";

const normalizeReplyKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const sanitizeReplyText = (reply: string) => {
  const seen = new Set<string>();

  return reply
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => {
      const key = normalizeReplyKey(part);
      if (!key || !seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    })
    .join("\n\n");
};

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
  triage: {
    summary: null,
    clarificationQuestion: null,
    missingDetails: [],
  },
  correction: { clearFields: [] },
  confidence: 0,
});

const greetingOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Xin chào, hệ thống có thể hỗ trợ bạn tìm chuyên khoa, gói khám, bác sĩ, lịch trống hoặc tra cứu lịch hẹn.",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 1,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
    {
      type: "LOOKUP_APPOINTMENT",
      label: "Tra cứu lịch hẹn",
      payload: {},
    },
  ],
});

const capabilitiesOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Tôi có thể giúp bạn tìm chuyên khoa, gói khám, bác sĩ và lịch trống; đồng thời hỗ trợ đặt lịch hoặc hướng dẫn tra cứu lịch hẹn. Bạn muốn bắt đầu từ đâu?",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 1,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Tìm chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
    {
      type: "LOOKUP_APPOINTMENT",
      label: "Tra cứu lịch hẹn",
      payload: {},
    },
  ],
});
const unsupportedInformationOutput = (
  draft: ChatBookingDraft,
): AIChatbotOutput => ({
  reply:
    "Tôi đang tập trung hỗ trợ thông tin bệnh viện và đặt lịch khám nên chưa thể trả lời chính xác câu hỏi này. Bạn có thể hỏi về chuyên khoa, bác sĩ, gói khám, lịch trống hoặc tra cứu lịch hẹn.",
  intent: "GENERAL_HOSPITAL_INFO",
  state: "BOOKING_GUIDE",
  nextStep: "SHOW_BOOKING_GUIDE",
  confidence: 0.8,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
  ],
});
const resetOutput = (): AIChatbotOutput => ({
  reply:
    "Thông tin lựa chọn trước đó đã được xóa. Bạn có thể bắt đầu lại bằng cách chọn chuyên khoa hoặc mô tả nhu cầu khám.",
  intent: "BOOKING_START",
  state: "BOOKING_GUIDE",
  nextStep: "CHOOSE_DEPARTMENT",
  confidence: 1,
  draft: {},
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
  ],
});

const emergencyOutput = (draft: ChatBookingDraft): AIChatbotOutput => ({
  reply:
    "Triệu chứng bạn mô tả có thể cần được xử lý khẩn cấp. Hãy đến cơ sở y tế gần nhất hoặc gọi cấp cứu ngay để được hỗ trợ kịp thời.",
  intent: "SYMPTOM_TRIAGE",
  state: "EMERGENCY_CARE",
  nextStep: "EMERGENCY_CARE",
  confidence: 1,
  draft,
  suggestedActions: [
    {
      type: "EMERGENCY_ADVICE",
      label: "Đến cơ sở y tế gần nhất",
      payload: {},
    },
    {
      type: "CONTACT_STAFF",
      label: "Liên hệ nhân viên hỗ trợ",
      payload: {},
    },
  ],
});

const fallbackOutput = (
  draft: ChatBookingDraft,
  aiUnavailable: boolean,
): AIChatbotOutput => ({
  reply: aiUnavailable
    ? "AI đang tạm thời không phản hồi. Hệ thống vẫn có thể hỗ trợ bạn qua các lựa chọn bên dưới."
    : "Hệ thống chưa xác định rõ yêu cầu. Bạn có thể chọn một chức năng bên dưới hoặc mô tả cụ thể hơn.",
  intent: "UNKNOWN",
  state: "BOOKING_GUIDE",
  nextStep: "CHOOSE_DEPARTMENT",
  confidence: 0.3,
  draft,
  suggestedActions: [
    { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
    { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
    {
      type: "LOOKUP_APPOINTMENT",
      label: "Tra cứu lịch hẹn",
      payload: {},
    },
  ],
});

class ChatbotService {
  async handleMessage(input: ChatbotRequestInput): Promise<ChatbotResponse> {
    // Chặn từ đầu nếu quản trị viên đã tắt chatbot.
    const runtimeSetting = await ChatbotSettingsService.getRuntimeSettings();
    if (!runtimeSetting.isActive) {
      throw new AppError(
        "Chatbot đang tạm tắt. Vui lòng gửi yêu cầu tư vấn để nhân viên hỗ trợ.",
        503,
      );
    }

    const settings = runtimeSetting.value;
    const session = await getOrCreateChatSession(
      input.sessionId,
      input.phone,
      settings.sessionExpiresDays,
    );
    const sessionId = session.id;
    const normalizedMessage = normalizeMessage(input.message);
    const requestDraft = sanitizeBookingDraft(
      mergeDrafts(session.draft, input.draft),
    );
    const actionDraft = ChatbotDraftReducer.reduceAction(
      requestDraft,
      input.action,
    );

    const finish = async (
      output: AIChatbotOutput,
      source: ChatbotResponseSource,
    ) => {
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
        updateChatSession(
          sessionId,
          response,
          input.message,
          input.phone,
          settings.sessionExpiresDays,
        ),
        this.saveLog(input, response),
      ]);
      return response;
    };

    if (hasEmergencySignal(normalizedMessage)) {
      return finish(emergencyOutput(actionDraft), "EMERGENCY");
    }

    const actionOperation = operationFromAction(input.action);
    let nlu = emptyNLUResult();
    let aiUnavailable = false;

    if (actionOperation) {
      nlu.operation = actionOperation;
      nlu.confidence = 1;
    } else if (settings.aiEnabled) {
      try {
        const catalog = await ChatbotContextService.loadNLUCatalog();
        nlu = await ChatbotNLUService.extract({
          message: input.message,
          draft: actionDraft,
          catalog,
          model: settings.model,
        });
      } catch (error) {
        aiUnavailable = true;
        if (!settings.fallbackEnabled) {
          throw new AppError(
            error instanceof Error
              ? "AI không thể phân tích yêu cầu: " + error.message
              : "AI không thể phân tích yêu cầu",
            502,
          );
        }
      }
    } else {
      aiUnavailable = true;
    }

    if (nlu.operation === "RESET_FLOW") {
      return finish(resetOutput(), "SYSTEM");
    }

    const resolved =
      actionOperation || nlu.confidence < 0.25
        ? { patch: {} }
        : await ChatbotEntityResolver.resolve(nlu);

    let draft = ChatbotDraftReducer.reduce(
      actionDraft,
      resolved.patch,
      nlu.correction,
    );
    const shouldResolveTriage =
      !actionOperation &&
      nlu.operation === "SEARCH_DEPARTMENT" &&
      Boolean(draft.symptoms?.length);
    const triageRecommendation = shouldResolveTriage
      ? await TriageRepository.findRecommendation(draft)
      : null;

    const shouldApplyTriageDepartment =
      triageRecommendation &&
      !resolved.patch.departmentId &&
      (!draft.departmentId ||
        (triageRecommendation.matched &&
          draft.departmentId !== triageRecommendation.departmentId));

    if (shouldApplyTriageDepartment && triageRecommendation) {
      draft = ChatbotDraftReducer.reduce(
        draft,
        {
          departmentId: triageRecommendation.departmentId,
          departmentSlug: triageRecommendation.departmentSlug || undefined,
        },
        { clearFields: [] },
      );
    }

    const intent = operationToIntent(nlu.operation, draft, nlu);

    if (nlu.operation === "GREETING") {
      return finish(greetingOutput(draft), "SYSTEM");
    }
    if (nlu.operation === "ASK_CAPABILITIES") {
      return finish(capabilitiesOutput(draft), "SYSTEM");
    }

    // Chỉ tải khoa/gói/bác sĩ/slot cần cho intent hiện tại để giảm truy vấn.
    const context = await ChatbotContextService.load(intent, draft);
    const shouldSearchFAQ =
      settings.faqEnabled &&
      [
        "GENERAL_HOSPITAL_INFO",
        "PAYMENT_GUIDE",
        "APPOINTMENT_LOOKUP_GUIDE",
        "UNKNOWN",
      ].includes(intent);

    if (shouldSearchFAQ) {
      const faqMatch = await ChatbotFAQRepository.findDirectAnswer(
        input.message,
        intent,
      );

      if (faqMatch) {
        return finish(
          composeFAQOutput({
            faq: faqMatch.faq,
            intent: faqMatch.intent,
            confidence: faqMatch.confidence,
            draft,
          }),
          "FAQ",
        );
      }
    }

    if (nlu.operation === "ASK_INFORMATION") {
      return finish(unsupportedInformationOutput(draft), "SYSTEM");
    }

    // Workflow server quyết định bước tiếp theo và dựng results/actions từ DB.
    const workflowOutput = ChatbotWorkflowService.resolve({
      message: input.message,
      detectedIntent: intent,
      context,
      draft,
      action: input.action,
      nlu,
      triageRecommendation,
    });

    if (workflowOutput) {
      const source =
        intent === "SYMPTOM_TRIAGE" && !actionOperation && !aiUnavailable
          ? "AI"
          : "SYSTEM";

      if (
        source === "AI" &&
        triageRecommendation &&
        workflowOutput.intent === "SYMPTOM_TRIAGE" &&
        workflowOutput.state === "SUGGESTING_DEPARTMENT"
      ) {
        workflowOutput.reply = await GroundedResponseService.composeTriageReply({
          userMessage: input.message,
          nlu,
          recommendation: triageRecommendation,
          fallbackReply: workflowOutput.reply,
          model: settings.model,
        });
      }

      return finish(workflowOutput, source);
    }

    return finish(fallbackOutput(draft, aiUnavailable), "FALLBACK");
  }

  private async saveLog(input: ChatbotRequestInput, response: ChatbotResponse) {
    await prisma.chatbotLog.create({
      data: {
        guestPhone: input.phone,
        sessionId: response.sessionId,
        message: input.message,
        response: response.reply,
        intent: response.intent,
      },
    });
  }
}

export default new ChatbotService();

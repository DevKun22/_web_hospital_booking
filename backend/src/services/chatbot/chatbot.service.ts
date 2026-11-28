import { prisma } from "../../config/prisma.js";
import { logger } from "../../observability/logger.js";
import { AppError } from "../../utils/appError.js";
import { getVietnamNowParts } from "../../utils/time.js";
import SiteSettingsService from "../siteSettings.service.js";
import ChatbotNLUService from "./ai/nlu.service.js";
import type { NLUResult } from "./ai/nlu.schema.js";
import ChatbotActionService from "./chatbot.actions.js";
import ChatbotContextService from "./chatbot.context.js";
import { buildDraftSummary } from "./chatbot.summary.js";
import ChatbotSettingsService from "./chatbot.settings.js";
import { appendHistory, openChatSession, saveChatSession, type ChatSessionState, type PendingAction } from "./chatbot.session.js";
import { createTrace, type ChatbotTrace, type OperationSource } from "./chatbot.trace.js";
import AppointmentFlow from "./flows/appointment.flow.js";
import ArticleSummaryFlow from "./flows/article-summary.flow.js";
import BookingFlow from "./flows/booking.flow.js";
import { applyFocus, withFocusName } from "./flows/follow-up.js";
import InfoFlow, { isNoInformationOutput, noInformationOutput, noInformationRepeatOutput, withConversationTopic } from "./flows/info.flow.js";
import {
  capabilitiesOutput,
  emergencyOutput,
  fallbackOutput,
  greetingOutput,
  resetOutput,
  resumeBookingAction,
} from "./flows/system.replies.js";
import TriageFlow from "./flows/triage.flow.js";
import { intentSpecOf } from "./intent/intent.spec.js";
import { parseVietnameseDateTime, type ParsedDateTime } from "./nlu/datetime.parser.js";
import ChatbotEntityResolver from "./retrieval/entity.resolver.js";
import { routeByRules, routeByHeuristics } from "./router/route.js";
import { hasEmergencySignal } from "./rules/emergency-detector.js";
import { maskPersonalData } from "./rules/pii-masker.js";
import { sanitizeReplyText } from "./rules/reply-sanitizer.js";
import { foldVietnamese, normalizeMessage } from "./rules/text-normalizer.js";
import ChatbotDraftReducer from "./workflow/draft.reducer.js";
import { operationFromAction, operationToIntent } from "./workflow/operation.js";
import type {
  AIChatbotOutput,
  ChatbotActor,
  ChatBookingDraft,
  ChatbotRequestInput,
  ChatbotResponse,
  ChatbotResponseSource,
  ChatOperation,
  SuggestedAction,
} from "./chatbot.types.js";

// Bộ điều phối một tin nhắn. Mỗi bước chỉ chạy khi bước trước chưa trả lời được; bước rẻ và an toàn đi trước:
//   1. Quy tắc cố định (tóm tắt bài viết).        2. Rào an toàn: dấu hiệu cấp cứu → 115, không qua AI.
//   3. Nút bấm (UI action) → thao tác rõ ràng, không cần AI.   4. Quy tắc chào/hỏi chức năng/làm lại.
//   5. Ngữ cảnh: trạng thái phiên do MÁY CHỦ giữ, vài lượt gần nhất, ngày giờ phân tích xác định.
//   6. AI phân tích ý định (một lần) → 7. đối chiếu thực thể với DB → 8. định tuyến theo đặc tả ý định (intent.spec.ts)
//   9. Luồng xử lý: INFO (RAG), BOOKING (máy trạng thái đặt lịch), APPOINTMENT (lịch cá nhân, cần đăng nhập), SYSTEM, FALLBACK
//  10. Kiểm nút gợi ý với DB → 11. lưu phiên (khóa lạc quan) và nhật ký kèm vết đã làm sạch.
// Danh tính người gửi (actor) chỉ đến từ token đã xác thực ở middleware; không lấy từ tin nhắn, body hay mã phiên.

const emptyNLUResult = (): NLUResult => ({
  operation: "UNKNOWN",
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
  triage: { summary: null, clarificationQuestion: null, missingDetails: [] },
  correction: { clearFields: [] },
  confidence: 0,
});

const BOOKING_CODE = /\bBK\d{14}\b/i;
/** Nội dung lưu thay cho câu trả lời có thông tin lịch hẹn cá nhân (phiên và nhật ký không giữ chi tiết lịch). */
const PERSONAL_REPLY_PLACEHOLDER = "[Câu trả lời chứa thông tin lịch hẹn cá nhân, không lưu nội dung]";
const PERSONAL_HISTORY_PLACEHOLDER = "[yêu cầu về lịch hẹn cá nhân]";

const hasSelection = (draft: ChatBookingDraft) => Boolean(draft.departmentId || draft.packageId || draft.doctorId || draft.timeSlotId);

/** Ngày giờ phân tích bằng quy tắc được ưu tiên hơn ngày giờ AI đoán (AI dễ tính sai thứ trong tuần, "ngày kia"...). */
const withDeterministicDateTime = (nlu: NLUResult, parsed: ParsedDateTime): NLUResult => ({
  ...nlu,
  entities: {
    ...nlu.entities,
    date: parsed.date ?? nlu.entities.date ?? null,
    timePeriod: parsed.timePeriod ?? nlu.entities.timePeriod ?? null,
    preferredTime: parsed.preferredTime ?? nlu.entities.preferredTime ?? null,
  },
});

/** Hai yêu cầu trong một câu: chỉ ghép khi một bên hỏi thông tin và bên kia thuộc luồng đặt lịch (cặp hay gặp, ghép an toàn). */
const isCombinable = (primary: ChatOperation, secondary: ChatOperation | null | undefined) => {
  if (!secondary || secondary === primary) return false;
  const handlers = new Set([intentSpecOf(primary).handler, intentSpecOf(secondary).handler]);
  return handlers.has("INFO") && handlers.has("BOOKING") && handlers.size === 2;
};

type Outcome = {
  output: AIChatbotOutput;
  source: ChatbotResponseSource;
  sourceIds?: string[];
  pendingAction?: PendingAction | null;
  personal?: boolean;
};

class ChatbotService {
  async handleMessage(rawInput: ChatbotRequestInput, actor: ChatbotActor = null): Promise<ChatbotResponse> {
    // Số điện thoại, email, số giấy tờ người dùng gõ vào khung chat được che ngay từ đầu: không lưu, không gửi cho dịch vụ AI.
    const input: ChatbotRequestInput = { ...rawInput, message: maskPersonalData(rawInput.message) };
    const startedAt = Date.now();
    const runtimeSetting = await ChatbotSettingsService.getRuntimeSettings();
    if (!runtimeSetting.isActive) {
      throw new AppError("Chatbot đang tạm tắt. Vui lòng gửi yêu cầu tư vấn để nhân viên hỗ trợ.", 503);
    }
    const settings = runtimeSetting.value;

    // Trạng thái chuẩn là của máy chủ: bản nháp client gửi kèm bị bỏ qua (chỉ còn trong hợp đồng để client cũ không lỗi).
    const session = await openChatSession(input.sessionId, actor, settings.sessionExpiresDays);
    const trace = createTrace({ sessionBinding: session.binding, authenticated: Boolean(actor), stateBefore: session.lastState });
    const mark = (stage: string) => {
      trace.stages[stage] = Date.now() - startedAt;
    };
    const baseDraft = ChatbotDraftReducer.reduceAction(session.draft, input.action);

    const finish = (outcome: Outcome) => this.finish({ input, actor, session, trace, outcome, settings, startedAt });

    // 1. Tóm tắt bài viết (nút ở trang bài viết): đúng bài đó, không qua định tuyến và truy hồi.
    if (input.action?.type === "SUMMARIZE_ARTICLE") {
      trace.handler = "ARTICLE";
      const slug = input.action.payload?.articleSlug;
      const summary =
        typeof slug === "string" && slug.trim()
          ? await ArticleSummaryFlow.summarize({ slug: slug.trim(), draft: baseDraft, aiEnabled: settings.aiEnabled, model: settings.model })
          : null;
      mark("summary");
      return finish(summary ? { output: summary.output, source: summary.source } : { output: noInformationOutput(baseDraft), source: "SYSTEM" });
    }

    // 2. Rào an toàn: luôn trước mọi thứ khác, kể cả khi đang chờ xác nhận hủy lịch.
    if (!input.action && hasEmergencySignal(normalizeMessage(input.message))) {
      trace.handler = "SAFETY";
      trace.operationSource = "SAFETY";
      const site = await SiteSettingsService.get().catch(() => null);
      const hotline = (site?.value as { emergencyHotline?: string | null } | null)?.emergencyHotline ?? null;
      return finish({ output: emergencyOutput(baseDraft, hotline), source: "EMERGENCY" });
    }

    // 3–4. Nút bấm và quy tắc: không tốn AI.
    let operation: ChatOperation | null = operationFromAction(input.action);
    let operationSource: OperationSource | null = operation ? "ACTION" : null;
    if (!operation) {
      const rule = routeByRules(input.message);
      if (rule !== "NEEDS_NLU") {
        operation = rule === "RESET" ? "RESET_FLOW" : rule === "GREETING" ? "GREETING" : "ASK_CAPABILITIES";
        operationSource = "RULE";
      }
    }

    // 5. Ngữ cảnh hội thoại.
    const today = getVietnamNowParts().date;
    const parsed = input.action ? {} : parseVietnameseDateTime(input.message, today);
    const bookingCode = input.action ? null : input.message.match(BOOKING_CODE)?.[0] ?? null;
    trace.deterministic = { date: Boolean(parsed.date), time: Boolean(parsed.preferredTime), period: Boolean(parsed.timePeriod), bookingCode: Boolean(bookingCode) };
    const question = withFocusName(
      withConversationTopic(input.message, { message: session.lastMessage, intent: session.lastIntent }),
      baseDraft.focus,
      foldVietnamese,
    );

    // Câu hỏi thông tin đã trả lời gần đây (bộ nhớ đệm): trả ngay, khỏi gọi AI. Không áp cho câu nhắc lịch hẹn cá nhân.
    if (!operation && settings.faqEnabled && settings.aiEnabled && !bookingCode) {
      const hit = InfoFlow.cached({ message: question, draft: baseDraft, aiEnabled: true, model: settings.model });
      if (hit) {
        trace.operation = "ASK_INFORMATION";
        trace.operationSource = "RULE";
        trace.handler = "INFO";
        trace.retrieval = hit.retrieval;
        return finish({ output: this.withResume(hit.output, baseDraft), source: hit.source, sourceIds: hit.sourceIds });
      }
    }

    // 6. AI phân tích ý định với vài lượt gần nhất và trạng thái hiện tại.
    let nlu = emptyNLUResult();
    let aiUnavailable = false;
    if (operation) {
      nlu.operation = operation;
      nlu.confidence = 1;
    } else if (settings.aiEnabled) {
      const nluStartedAt = Date.now();
      try {
        nlu = await ChatbotNLUService.extract({
          message: question,
          draft: baseDraft,
          catalog: await ChatbotContextService.loadNLUCatalog(),
          history: session.history.map((turn) => ({ user: turn.user, operation: turn.operation })),
          state: session.lastState,
          model: settings.model,
        });
        trace.aiCalls.push({ purpose: "NLU", ok: true, ms: Date.now() - nluStartedAt });
        operationSource = "NLU";
      } catch (error) {
        trace.aiCalls.push({ purpose: "NLU", ok: false, ms: Date.now() - nluStartedAt });
        aiUnavailable = true;
        logger.warn("[CHATBOT] Không phân tích được ý định bằng AI, dùng đường lùi:", error instanceof Error ? error.message : "lỗi không rõ");
        if (!settings.fallbackEnabled) throw new AppError("AI không thể phân tích yêu cầu", 502);
      }
    } else {
      aiUnavailable = true;
    }
    if (aiUnavailable && !operation) {
      // AI không dùng được: vài dấu hiệu rõ ràng (hủy/đổi/xem lịch của tôi, mã đặt lịch) vẫn định tuyến đúng bằng quy tắc.
      const heuristic = routeByHeuristics(input.message);
      if (heuristic) {
        nlu.operation = heuristic;
        nlu.confidence = 0.6;
        operationSource = "HEURISTIC";
      }
    }
    mark("nlu");
    nlu = withDeterministicDateTime(nlu, parsed);
    // Câu ngắn chỉ có ngày giờ ("9 giờ được không", "chiều mai") khi đang đặt lịch dở là hỏi lịch trống, không phải câu vô nghĩa.
    if (nlu.operation === "UNKNOWN" && (parsed.date || parsed.preferredTime || parsed.timePeriod) && (hasSelection(baseDraft) || session.lastState?.startsWith("CHOOSING"))) {
      nlu.operation = "SEARCH_SLOT";
    }
    if (nlu.operation === "UNKNOWN" && bookingCode) nlu.operation = "LOOKUP_APPOINTMENT";
    operation = nlu.operation;
    trace.operation = operation;
    trace.operationSource = operationSource;
    trace.secondaryOperation = nlu.secondaryOperation ?? null;

    const spec = intentSpecOf(operation);
    trace.handler = spec.handler;

    // 8a. Câu cố định.
    if (operation === "RESET_FLOW") return finish({ output: resetOutput(), source: "SYSTEM", pendingAction: null });
    if (operation === "GREETING") return finish({ output: greetingOutput(baseDraft), source: "SYSTEM" });
    if (operation === "ASK_CAPABILITIES") return finish({ output: capabilitiesOutput(baseDraft), source: "SYSTEM" });

    // 8b. Lịch hẹn cá nhân: không qua đối chiếu thực thể đặt lịch, không qua RAG, không gọi AI thêm.
    if (spec.handler === "APPOINTMENT") {
      const result = await AppointmentFlow.handle({
        operation,
        action: input.action,
        actor,
        session,
        draft: baseDraft,
        message: input.message,
        appointmentRef: nlu.entities.appointmentRef ?? bookingCode,
      });
      trace.mutated = Boolean(result.mutated);
      mark("appointment");
      return finish({ output: result.output, source: "SYSTEM", pendingAction: result.pendingAction, personal: result.personal });
    }

    // 7. Thực thể AI trích ra được đối chiếu với DB, chỉ giữ phần xác minh được.
    const resolved = operationSource === "ACTION" || nlu.confidence < 0.25 ? { patch: {} } : await ChatbotEntityResolver.resolve(nlu);
    // Ngày giờ phân tích xác định luôn được áp, kể cả khi AI không chạy hoặc kém chắc chắn. Nói buổi/ngày mới mà không nêu giờ
    // thì bỏ giờ cụ thể cũ, để "chiều mai" sau "9 giờ" không còn tìm 9 giờ.
    const dateTimePatch: Partial<ChatBookingDraft> = {
      date: nlu.entities.date ?? undefined,
      timePeriod: nlu.entities.timePeriod ?? undefined,
      preferredTime: nlu.entities.preferredTime ?? undefined,
    };
    const draftBeforeReduce =
      (dateTimePatch.date || dateTimePatch.timePeriod) && !dateTimePatch.preferredTime ? { ...baseDraft, preferredTime: undefined } : baseDraft;
    let draft = ChatbotDraftReducer.reduce(draftBeforeReduce, { ...resolved.patch, ...dateTimePatch }, nlu.correction);
    if (operationSource !== "ACTION") draft = applyFocus(draft, operation, resolved.patch);
    const repeated = session.lastMessage !== null && foldVietnamese(session.lastMessage) === foldVietnamese(input.message);

    // 8c. Thông tin → RAG. UNKNOWN cũng thử kho tri thức trước khi trả lời dự phòng.
    const wantsInfo =
      operationSource !== "ACTION" && settings.faqEnabled && (spec.handler === "INFO" || spec.handler === "FALLBACK" || isCombinable(operation, nlu.secondaryOperation));
    let infoOutcome: Outcome | null = null;
    let nearby: SuggestedAction[] = [];
    if (wantsInfo) {
      const info = await InfoFlow.answer({ message: question, draft, aiEnabled: settings.aiEnabled, model: settings.model });
      mark("info");
      if (info && "noAnswer" in info) {
        // Có đoạn gần nghĩa nhưng không trả lời được: giữ vết truy hồi và đưa vài câu hỏi gần nhất vào câu "chưa có thông tin".
        trace.retrieval = info.retrieval;
        trace.numericRejected = info.numericRejected;
        if (info.ai) trace.aiCalls.push({ purpose: "RAG_ANSWER", ok: info.ai.ok, ms: info.ai.ms });
        nearby = info.nearby;
      } else if (info) {
        trace.retrieval = info.retrieval;
        trace.numericRejected = Boolean(info.numericRejected);
        if (info.ai) trace.aiCalls.push({ purpose: "RAG_ANSWER", ok: info.ai.ok, ms: info.ai.ms });
        infoOutcome = { output: this.withResume(info.output, draft), source: info.source, sourceIds: info.sourceIds };
      }
      const secondaryIsBooking = isCombinable(operation, nlu.secondaryOperation);
      if (!secondaryIsBooking) {
        if (infoOutcome) return finish(infoOutcome);
        if (spec.handler === "INFO") {
          const none = repeated ? noInformationRepeatOutput(draft) : noInformationOutput(draft, nearby);
          return finish({ output: this.withResume(none, draft), source: "SYSTEM" });
        }
      }
    }

    // 8d. Đặt lịch (cả khi thao tác chính là thông tin nhưng câu còn kèm yêu cầu đặt lịch).
    const bookingOperation: ChatOperation =
      spec.handler === "BOOKING" ? operation : isCombinable(operation, nlu.secondaryOperation) ? (nlu.secondaryOperation as ChatOperation) : operation;
    const booking = await this.runBooking({ input, draft, nlu: { ...nlu, operation: bookingOperation }, operationSource, aiUnavailable, model: settings.model, trace });
    mark("booking");

    if (booking && infoOutcome) {
      // Câu hai ý: trả lời phần thông tin trước, rồi bước đặt lịch; nút và kết quả theo luồng đặt lịch.
      return finish({
        output: { ...booking.output, reply: `${infoOutcome.output.reply}\n\n${booking.output.reply}`, sources: infoOutcome.output.sources },
        source: infoOutcome.source,
        sourceIds: infoOutcome.sourceIds,
      });
    }
    if (booking) return finish(booking);
    if (infoOutcome) return finish(infoOutcome);
    const fallback = repeated ? noInformationRepeatOutput(draft) : fallbackOutput(draft, aiUnavailable, input.message);
    return finish({ output: this.withResume(fallback, draft), source: "FALLBACK" });
  }

  /** Luồng đặt lịch: gợi ý khoa theo triệu chứng nếu cần, rồi máy trạng thái đặt lịch dựng bước kế tiếp từ DB. */
  private async runBooking(input: {
    input: ChatbotRequestInput;
    draft: ChatBookingDraft;
    nlu: NLUResult;
    operationSource: OperationSource | null;
    aiUnavailable: boolean;
    model?: string;
    trace: ChatbotTrace;
  }): Promise<Outcome | null> {
    let draft = input.draft;
    const fromAction = input.operationSource === "ACTION";
    const wantsTriage = !fromAction && input.nlu.operation === "SEARCH_DEPARTMENT" && Boolean(draft.symptoms?.length);
    const triage = wantsTriage ? await TriageFlow.recommend(draft) : null;
    if (triage && !draft.departmentId) {
      draft = ChatbotDraftReducer.reduce(draft, { departmentId: triage.departmentId, departmentSlug: triage.departmentSlug || undefined }, { clearFields: [] });
    } else if (triage && triage.matched && draft.departmentId !== triage.departmentId && !input.nlu.entities.departmentName) {
      draft = ChatbotDraftReducer.reduce(draft, { departmentId: triage.departmentId, departmentSlug: triage.departmentSlug || undefined }, { clearFields: [] });
    }

    const intent = operationToIntent(input.nlu.operation, draft, input.nlu);
    const context = await ChatbotContextService.load(intent, draft);
    const output = BookingFlow.resolve({
      message: input.input.message,
      detectedIntent: intent,
      context,
      draft,
      action: input.input.action,
      nlu: input.nlu,
      triageRecommendation: triage,
    });
    if (!output) return null;
    output.draft = { ...output.draft, focus: undefined };

    const aiPhrased = intent === "SYMPTOM_TRIAGE" && !fromAction && !input.aiUnavailable;
    if (aiPhrased && triage && output.intent === "SYMPTOM_TRIAGE" && output.state === "SUGGESTING_DEPARTMENT") {
      const startedAt = Date.now();
      const fallbackReply = output.reply;
      output.reply = await TriageFlow.composeReply({ userMessage: input.input.message, nlu: input.nlu, recommendation: triage, fallbackReply, model: input.model });
      input.trace.aiCalls.push({ purpose: "TRIAGE_REPLY", ok: output.reply !== fallbackReply, ms: Date.now() - startedAt });
    }
    return { output, source: aiPhrased ? "AI" : "SYSTEM" };
  }

  /** Đổi chủ đề giữa lúc đặt lịch (hỏi giá, hỏi chính sách): bản nháp vẫn giữ, kèm nút quay lại đặt lịch. */
  private withResume(output: AIChatbotOutput, draft: ChatBookingDraft): AIChatbotOutput {
    const resume = resumeBookingAction(draft).filter((action) => !output.suggestedActions.some((item) => item.type === action.type));
    // Nút quay lại đứng đầu: danh sách nút bị giới hạn (maxSuggestedActions), không được để nó bị cắt mất.
    return { ...output, draft: { ...draft, ...output.draft }, suggestedActions: [...resume, ...output.suggestedActions] };
  }

  private async finish(input: {
    input: ChatbotRequestInput;
    actor: ChatbotActor;
    session: ChatSessionState;
    trace: ChatbotTrace;
    outcome: Outcome;
    settings: { maxSuggestedActions: number; sessionExpiresDays: number };
    startedAt: number;
  }): Promise<ChatbotResponse> {
    const { outcome, session, trace } = input;
    const output = outcome.output;
    const suggestedActions = await ChatbotActionService.validateActions(output.suggestedActions, output.draft, input.settings.maxSuggestedActions);
    // undefined: luồng không đụng tới thao tác chờ → giữ nguyên (nhưng bỏ nếu đã hết hạn).
    const pendingAction =
      outcome.pendingAction !== undefined
        ? outcome.pendingAction
        : session.pendingAction && new Date(session.pendingAction.expiresAt).getTime() > Date.now()
          ? session.pendingAction
          : null;

    const response: ChatbotResponse = {
      contractVersion: 2,
      traceId: trace.traceId,
      sessionId: session.id,
      source: outcome.source,
      ...output,
      reply: sanitizeReplyText(output.reply),
      suggestedActions,
      draftSummary: await buildDraftSummary(output.draft),
      pendingAction: pendingAction ? { type: pendingAction.type, expiresAt: pendingAction.expiresAt } : null,
    };
    trace.stateAfter = response.state;
    trace.latencyMs = Date.now() - input.startedAt;

    const storedReply = outcome.personal ? PERSONAL_REPLY_PLACEHOLDER : response.reply;
    // Lưu phiên trước (để vết biết lượt này có bị xung đột không), rồi nhật ký. Lỗi ghi không được làm mất câu trả lời đã có.
    const saved = await saveChatSession(session, {
      response,
      message: input.input.message,
      // Lượt về lịch hẹn cá nhân không lưu nguyên văn vào lịch sử (lịch sử được gửi cho AI ở các lượt sau).
      history: appendHistory(session.history, outcome.personal ? PERSONAL_HISTORY_PLACEHOLDER : input.input.message, trace.operation),
      pendingAction,
      storedReply,
      sessionExpiresDays: input.settings.sessionExpiresDays,
    }).catch((error) => {
      logger.warn("[CHATBOT] Không lưu được phiên trò chuyện:", error instanceof Error ? error.message : "lỗi không rõ");
      return true;
    });
    if (!saved) {
      trace.conflict = true;
      logger.warn("[CHATBOT] Phiên vừa được một yêu cầu khác cập nhật; lượt này không ghi đè trạng thái.", JSON.stringify({ traceId: trace.traceId, mutated: trace.mutated }));
      // Trạng thái của lượt này không được lưu: không trả câu trả lời như thể đã lưu (client sẽ hiện bản nháp, nút không khớp máy chủ).
      // Riêng lượt đã thay đổi dữ liệu thật (hủy lịch đã xong) thì kết quả là sự thật, vẫn phải báo cho người dùng.
      if (!trace.mutated) {
        logger.info("[CHATBOT_TRACE]", JSON.stringify(trace));
        throw new AppError("Kun đang trả lời tin trước của bạn. Bạn đợi một chút rồi gửi lại nhé.", 409, "CHATBOT_CONFLICT");
      }
    }
    const messageId = await this.saveLog({
      sessionId: session.id,
      userId: input.actor?.userId ?? null,
      message: input.input.message,
      response: storedReply,
      intent: response.intent,
      sourceIds: outcome.sourceIds ?? [],
      noInformation: isNoInformationOutput(output, outcome.source),
      trace,
    }).catch((error) => {
      logger.warn("[CHATBOT] Không ghi được nhật ký trò chuyện:", error instanceof Error ? error.message : "lỗi không rõ");
      return undefined;
    });
    response.messageId = messageId;
    logger.info("[CHATBOT_TRACE]", JSON.stringify(trace));
    return response;
  }

  /** Ghi nhận phản hồi hữu ích / chưa đúng của người dùng cho một câu trả lời; chỉ chấp nhận khi mã nhật ký thuộc đúng phiên đó. */
  async recordFeedback(input: { sessionId: string; messageId: string; value: "HELPFUL" | "NOT_HELPFUL" }) {
    const result = await prisma.chatbotLog.updateMany({
      where: { id: input.messageId, sessionId: input.sessionId },
      data: { feedback: input.value, feedbackAt: new Date() },
    });
    if (!result.count) throw new AppError("Không tìm thấy câu trả lời cần phản hồi", 404);
  }

  private async saveLog(input: {
    sessionId: string;
    userId: string | null;
    message: string;
    response: string;
    intent: string;
    sourceIds: string[];
    noInformation: boolean;
    trace: ChatbotTrace;
  }) {
    const log = await prisma.chatbotLog.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        message: input.message,
        response: input.response,
        intent: input.intent,
        sourceIds: input.sourceIds,
        noInformation: input.noInformation,
        trace: JSON.parse(JSON.stringify(input.trace)),
      },
      select: { id: true },
    });
    return log.id;
  }
}

export default new ChatbotService();

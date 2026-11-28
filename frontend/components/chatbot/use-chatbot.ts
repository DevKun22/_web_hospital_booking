"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { PatientApiError, patientApiRequest } from "@/lib/patient-portal-api";
import { loadOptionalPatientSession, patientSessionQueryKey } from "@/lib/patient-session-client";
import {
  CHATBOT_STORAGE_KEY,
  describeChatError,
  getAskQuestion,
  getInputPlaceholder,
  getLoadingText,
  getNavigationTarget,
  isNoInformationReply,
  type ChatWidgetMessage,
  type ClearableField,
} from "@/lib/chatbot-ui";
import type {
  ChatBookingDraft,
  ChatbotDraftSummary,
  ChatbotMessageResponse,
  ChatbotSuggestedAction,
} from "@/lib/types";

// Toàn bộ trạng thái và thao tác của cuộc trò chuyện: giữ phiên, bản nháp đặt lịch, tin nhắn (lưu trong trình duyệt),
// gửi tin, thử lại khi lỗi, bỏ một lựa chọn. Giao diện chỉ việc hiển thị, không tự gọi máy chủ.

const STORAGE_KEY = CHATBOT_STORAGE_KEY;
/** Chỉ nhớ phần cuối của cuộc trò chuyện để bộ nhớ trình duyệt không phình ra. */
const MAX_STORED_MESSAGES = 40;
/** Quá hạn này thì bắt đầu cuộc trò chuyện mới: lịch trống và lựa chọn cũ đã lỗi thời. */
const STORED_TTL_MS = 24 * 60 * 60 * 1000;

/** Gợi ý ban đầu khi chưa có cuộc trò chuyện: người dùng biết ngay có thể hỏi gì, khỏi nhìn ô trống. */
const STARTER_ACTIONS: ChatbotSuggestedAction[] = [
  { type: "VIEW_DEPARTMENTS", label: "Tìm khoa theo triệu chứng", payload: {} },
  { type: "VIEW_PACKAGES", label: "Khám sức khỏe định kỳ", payload: {} },
  { type: "ASK_QUESTION", label: "Khám cho trẻ em", payload: { question: "Khám cho trẻ em thì nên chọn chuyên khoa nào?" } },
  { type: "LOOKUP_APPOINTMENT", label: "Tra cứu lịch hẹn", payload: {} },
];

/** Lối đi thay thế khi Kun không trả lời được: không phụ thuộc máy chủ chatbot (đều là nút chuyển trang hoặc gửi lại sau). */
const FALLBACK_ACTIONS: ChatbotSuggestedAction[] = [
  { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
  { type: "CONTACT_STAFF", label: "Hỏi nhân viên hỗ trợ", payload: {} },
];

const WELCOME: ChatWidgetMessage = {
  id: "welcome",
  role: "assistant",
  content: "Chào bạn, mình là Kun, trợ lý ảo của DevKunCare. Mình giúp bạn tìm bác sĩ, gói khám, xem lịch trống và đặt lịch. Bạn muốn bắt đầu từ đâu?",
  actions: STARTER_ACTIONS,
};

type Stored = {
  sessionId?: string;
  draft?: ChatBookingDraft;
  draftSummary?: ChatbotDraftSummary;
  messages?: ChatWidgetMessage[];
  savedAt?: number;
  /** Tài khoản sở hữu cuộc trò chuyện (đã đăng nhập khi trò chuyện); khác tài khoản hiện tại thì xóa, không để lộ lịch hẹn của người trước. */
  ownerId?: string;
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readStored = (): Stored => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Stored;
    return stored.savedAt && Date.now() - stored.savedAt < STORED_TTL_MS ? stored : {};
  } catch {
    return {};
  }
};

/** `echoText`: chữ hiện trong khung chat của người dùng khi khác với nội dung gửi đi (nút hỏi thêm: nhãn ngắn, gửi câu đầy đủ). */
type SendOptions = { action?: ChatbotSuggestedAction; echo?: boolean; echoText?: string };

export function useChatbot({ online }: { online: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Đã đăng nhập thì gửi qua máy chủ web (gắn phiên người khám) để Kun xem và hủy lịch của chính bạn; khách gọi thẳng API.
  const sessionQuery = useQuery({ queryKey: patientSessionQueryKey, queryFn: loadOptionalPatientSession, retry: false, staleTime: 30_000 });
  const signedIn = Boolean(sessionQuery.data);
  const [sessionId, setSessionId] = useState<string>();
  const [draft, setDraft] = useState<ChatBookingDraft>();
  const [draftSummary, setDraftSummary] = useState<ChatbotDraftSummary>();
  const [messages, setMessages] = useState<ChatWidgetMessage[]>([WELCOME]);
  const [sending, setSending] = useState(false);
  const [loadingText, setLoadingText] = useState(getLoadingText());
  const [placeholder, setPlaceholder] = useState(getInputPlaceholder());
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [ownerId, setOwnerId] = useState<string>();
  const sendingRef = useRef(false);
  const lastRequestRef = useRef<{ content: string; action?: ChatbotSuggestedAction } | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStored();
      if (stored.sessionId) setSessionId(stored.sessionId);
      if (stored.draft) setDraft(stored.draft);
      if (stored.draftSummary) setDraftSummary(stored.draftSummary);
      if (stored.messages?.length) setMessages(stored.messages);
      if (stored.ownerId) setOwnerId(stored.ownerId);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessionId, draft, draftSummary, messages: messages.slice(-MAX_STORED_MESSAGES), savedAt: Date.now(), ownerId } satisfies Stored),
      );
    } catch {
      // Trình duyệt chặn hoặc đầy bộ nhớ: cuộc trò chuyện vẫn chạy, chỉ không nhớ lại được.
    }
  }, [draft, draftSummary, hydrated, messages, ownerId, sessionId]);

  const send = useCallback(
    async (content: string, { action, echo = !action, echoText }: SendOptions = {}) => {
      const text = content.trim();
      if (!text || sendingRef.current) return;

      // Nút chuyển trang (đặt lịch, tra cứu, liên hệ) đi thẳng tới trang đích, khỏi một vòng hỏi máy chủ.
      const target = action ? getNavigationTarget(action, draft, signedIn) : null;
      if (target) {
        router.push(target);
        return;
      }
      if (!online) {
        setNotice("Chatbot đang tạm tắt. Bạn gửi yêu cầu tư vấn để nhân viên hỗ trợ nhé.");
        return;
      }

      sendingRef.current = true;
      lastRequestRef.current = { content: text, action };
      if (echo) setMessages((current) => [...current, { id: createId(), role: "user", content: echoText || text }]);
      setNotice("");
      setPlaceholder(getInputPlaceholder(action));
      setLoadingText(getLoadingText(action));
      setSending(true);

      try {
        // Trạng thái hội thoại do máy chủ giữ: chỉ gửi mã phiên, tin nhắn và nút vừa bấm (không gửi bản nháp).
        const body = { sessionId, message: text, action: action && { type: action.type, label: action.label, payload: action.payload } };
        const askGuest = () => apiRequest<ChatbotMessageResponse>("/chatbot/message", { method: "POST", body });
        let result: ChatbotMessageResponse;
        if (signedIn) {
          try {
            result = (await patientApiRequest<ChatbotMessageResponse>("/tro-ly", { method: "POST", body: JSON.stringify(body) })).data;
          } catch (error) {
            // Phiên đăng nhập vừa hết hạn: chuyển về chế độ khách và hỏi lại một lần.
            if (!(error instanceof PatientApiError) || error.status !== 401) throw error;
            queryClient.setQueryData(patientSessionQueryKey, null);
            result = await askGuest();
          }
        } else {
          result = await askGuest();
        }
        setSessionId(result.sessionId);
        setDraft(result.draft);
        setDraftSummary(result.draftSummary);
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: result.state === "EMERGENCY_CARE" ? "alert" : "assistant",
            content: result.reply,
            kind: isNoInformationReply(result) ? "no-info" : undefined,
            messageId: result.messageId,
            results: result.results,
            sources: result.sources,
            actions: result.suggestedActions,
          },
        ]);
      } catch (error) {
        const failure = describeChatError(error, typeof navigator === "undefined" ? true : navigator.onLine);
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content: failure.content,
            kind: failure.kind,
            retryable: failure.retryable,
            // Kun tạm nghỉ hoặc đang nghỉ giữa chừng: vẫn cho lối đi khác thay vì dừng ở lời xin lỗi.
            actions: failure.kind === "offline" || failure.kind === "rate-limited" ? FALLBACK_ACTIONS : undefined,
          },
        ]);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [draft, online, queryClient, router, sessionId, signedIn],
  );

  /** Bấm một gợi ý: nút hỏi thêm gửi câu hỏi đầy đủ như người dùng gõ; các nút còn lại gửi kèm thao tác để máy chủ dựng bước kế tiếp. */
  const pick = useCallback(
    (action: ChatbotSuggestedAction) => {
      const question = getAskQuestion(action);
      if (question) void send(question, { echoText: action.label });
      // Tóm tắt bài viết bắt đầu từ trang bài viết: hiện yêu cầu của người dùng trong khung chat để cuộc trò chuyện đọc liền mạch.
      else if (action.type === "SUMMARIZE_ARTICLE") void send(action.label, { action, echo: true });
      else void send(action.label, { action });
    },
    [send],
  );

  /** Gửi phản hồi hữu ích / chưa đúng cho một câu trả lời; hiện ngay, lỗi mạng thì hoàn lại và nhắc thử lại. */
  const rate = useCallback(
    async (messageId: string, value: "HELPFUL" | "NOT_HELPFUL") => {
      if (!sessionId) return;
      const set = (feedback?: "HELPFUL" | "NOT_HELPFUL") =>
        setMessages((current) => current.map((item) => (item.messageId === messageId ? { ...item, feedback } : item)));
      set(value);
      try {
        await apiRequest("/chatbot/feedback", { method: "POST", body: { sessionId, messageId, value } });
      } catch {
        set(undefined);
        setNotice("Chưa gửi được phản hồi, bạn thử lại sau nhé.");
      }
    },
    [sessionId],
  );

  /** Gửi lại yêu cầu vừa lỗi (không lặp tin của người dùng). */
  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) return;
    setMessages((current) => current.filter((item) => !item.retryable));
    void send(last.content, { action: last.action, echo: false });
  }, [send]);

  /** Bỏ một lựa chọn đã chọn (khoa, gói, bác sĩ, giờ); máy chủ trả về bước phù hợp kế tiếp. */
  const clearSelection = useCallback(
    (field: ClearableField, label: string) => {
      setMessages((current) => [...current, { id: createId(), role: "system", content: `Đã bỏ: ${label}` }]);
      void send(`Bỏ ${label}`, { action: { type: "CLEAR_SELECTION", label: `Bỏ ${label}`, payload: { field } } });
    },
    [send],
  );

  const reset = useCallback(() => {
    setSessionId(undefined);
    setDraft(undefined);
    setDraftSummary(undefined);
    setMessages([WELCOME]);
    setNotice("");
    setPlaceholder(getInputPlaceholder());
    lastRequestRef.current = undefined;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Không xóa được bộ nhớ trình duyệt thì bỏ qua.
    }
  }, []);

  // Đăng xuất hoặc đổi tài khoản (kể cả ở thẻ khác rồi tải lại trang): cuộc trò chuyện có thể chứa thẻ lịch hẹn của người trước,
  // nên xóa. Khách vừa đăng nhập thì giữ (cuộc trò chuyện của chính họ) và ghi nhận chủ mới. Điều chỉnh ngay khi render
  // (mẫu "đổi state theo giá trị vào" của React), không qua effect.
  const currentUserId = sessionQuery.isSuccess ? (sessionQuery.data?.id ?? null) : undefined;
  const [checkedUserId, setCheckedUserId] = useState<string | null>();
  if (hydrated && currentUserId !== undefined && currentUserId !== checkedUserId) {
    setCheckedUserId(currentUserId);
    if (ownerId && ownerId !== currentUserId) {
      setSessionId(undefined);
      setDraft(undefined);
      setDraftSummary(undefined);
      setMessages([WELCOME]);
      setNotice("");
      setOwnerId(currentUserId ?? undefined);
    } else if (!ownerId && currentUserId) {
      setOwnerId(currentUserId);
    }
  }

  return { messages, draft, draftSummary, sending, loadingText, placeholder, notice, send, pick, rate, retry, clearSelection, reset };
}

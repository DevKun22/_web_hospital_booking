"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  getInputPlaceholder,
  getLoadingText,
  getNavigationTarget,
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

const STORAGE_KEY = "hospital-public-chatbot";
/** Chỉ nhớ phần cuối của cuộc trò chuyện để bộ nhớ trình duyệt không phình ra. */
const MAX_STORED_MESSAGES = 40;
/** Quá hạn này thì bắt đầu cuộc trò chuyện mới: lịch trống và lựa chọn cũ đã lỗi thời. */
const STORED_TTL_MS = 24 * 60 * 60 * 1000;

const WELCOME: ChatWidgetMessage = {
  id: "welcome",
  role: "assistant",
  content: "Chào bạn, mình là Kun, trợ lý ảo của DevKunCare. Mình có thể giúp bạn tìm bác sĩ, gói khám, xem lịch trống và đặt lịch. Bạn cần gì nào?",
};

/** Gợi ý ban đầu khi chưa có cuộc trò chuyện: người dùng biết ngay có thể hỏi gì, khỏi nhìn ô trống. */
const DEFAULT_ACTIONS: ChatbotSuggestedAction[] = [
  { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
  { type: "VIEW_PACKAGES", label: "Xem gói khám", payload: {} },
  { type: "LOOKUP_APPOINTMENT", label: "Tra cứu lịch hẹn", payload: {} },
];

type Stored = {
  sessionId?: string;
  draft?: ChatBookingDraft;
  draftSummary?: ChatbotDraftSummary;
  messages?: ChatWidgetMessage[];
  actions?: ChatbotSuggestedAction[];
  savedAt?: number;
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

type SendOptions = { action?: ChatbotSuggestedAction; echo?: boolean };

export function useChatbot({ online }: { online: boolean }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>();
  const [draft, setDraft] = useState<ChatBookingDraft>();
  const [draftSummary, setDraftSummary] = useState<ChatbotDraftSummary>();
  const [messages, setMessages] = useState<ChatWidgetMessage[]>([WELCOME]);
  const [actions, setActions] = useState<ChatbotSuggestedAction[]>(DEFAULT_ACTIONS);
  const [sending, setSending] = useState(false);
  const [loadingText, setLoadingText] = useState(getLoadingText());
  const [placeholder, setPlaceholder] = useState(getInputPlaceholder());
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const sendingRef = useRef(false);
  const lastRequestRef = useRef<{ content: string; action?: ChatbotSuggestedAction } | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStored();
      if (stored.sessionId) setSessionId(stored.sessionId);
      if (stored.draft) setDraft(stored.draft);
      if (stored.draftSummary) setDraftSummary(stored.draftSummary);
      if (stored.messages?.length) setMessages(stored.messages);
      if (stored.actions) setActions(stored.actions);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessionId, draft, draftSummary, messages: messages.slice(-MAX_STORED_MESSAGES), actions, savedAt: Date.now() } satisfies Stored),
      );
    } catch {
      // Trình duyệt chặn hoặc đầy bộ nhớ: cuộc trò chuyện vẫn chạy, chỉ không nhớ lại được.
    }
  }, [actions, draft, draftSummary, hydrated, messages, sessionId]);

  const send = useCallback(
    async (content: string, { action, echo = !action }: SendOptions = {}) => {
      const text = content.trim();
      if (!text || sendingRef.current) return;

      // Nút chuyển trang (đặt lịch, tra cứu, liên hệ) đi thẳng tới trang đích, khỏi một vòng hỏi máy chủ.
      const target = action ? getNavigationTarget(action, draft) : null;
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
      if (echo) setMessages((current) => [...current, { id: createId(), role: "user", content: text }]);
      setActions([]);
      setNotice("");
      setPlaceholder(getInputPlaceholder(action));
      setLoadingText(getLoadingText(action));
      setSending(true);

      try {
        const result = await apiRequest<ChatbotMessageResponse>("/chatbot/message", {
          method: "POST",
          body: { sessionId, message: text, draft, action: action && { type: action.type, label: action.label, payload: action.payload } },
        });
        setSessionId(result.sessionId);
        setDraft(result.draft);
        setDraftSummary(result.draftSummary);
        setActions(result.suggestedActions || []);
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: result.state === "EMERGENCY_CARE" ? "alert" : "assistant",
            content: result.reply,
            results: result.results,
            sources: result.sources,
          },
        ]);
      } catch {
        setMessages((current) => [
          ...current,
          { id: createId(), role: "assistant", content: "Ôi, mình chưa gửi được tin này. Bạn thử lại giúp mình nhé.", retryable: true },
        ]);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [draft, online, router, sessionId],
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
    setActions(DEFAULT_ACTIONS);
    setNotice("");
    setPlaceholder(getInputPlaceholder());
    lastRequestRef.current = undefined;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Không xóa được bộ nhớ trình duyệt thì bỏ qua.
    }
  }, []);

  return { messages, actions, draft, draftSummary, sending, loadingText, placeholder, notice, send, retry, clearSelection, reset };
}

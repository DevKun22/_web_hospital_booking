"use client";

import { Bot, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { ChatbotResultCards } from "@/components/ui/chatbot-result-cards";
import { usePublicChatbotSettings } from "@/lib/public-chatbot-query";
import {
  PUBLIC_CHATBOT_CLOSE_EVENT,
  PUBLIC_CONSULTATION_CLOSE_EVENT,
  setPublicFloatingPanelVisibility,
} from "@/lib/public-ui-events";
import {
  buildBookingHref,
  getActionInputPlaceholder,
  getActionLoadingText,
  getActionRenderKey,
  getFlowStatusText,
  getResponseSourceLabel,
  type ChatWidgetMessage,
} from "@/lib/chatbot-ui";
import type {
  ChatBookingDraft,
  ChatbotMessageResponse,
  ChatbotSuggestedAction,
} from "@/lib/types";

type StoredChat = {
  sessionId?: string;
  draft?: ChatBookingDraft;
  messages?: ChatWidgetMessage[];
};

const storageKey = "hospital-public-chatbot";

const defaultMessages: ChatWidgetMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    source: "SYSTEM",
    content:
      "Xin chào, tôi có thể hỗ trợ đặt lịch, tra cứu bác sĩ, gói khám và giải đáp nhanh trước khi bạn đến bệnh viện.",
  },
];

const chatbotSuggestionMessages = [
  "Bạn muốn tìm bác sĩ phù hợp?",
  "Cần hỏi nhanh về gói khám?",
  "Muốn tra cứu hướng dẫn đặt lịch?",
  "Chưa rõ nên chọn chuyên khoa nào?",
];

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readStoredChat = (): StoredChat => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(
      window.localStorage.getItem(storageKey) || "{}",
    ) as StoredChat;
  } catch {
    return {};
  }
};

export function PublicChatbotWidget() {
  const settingsQuery = usePublicChatbotSettings();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [draft, setDraft] = useState<ChatBookingDraft | undefined>();
  const [messages, setMessages] =
    useState<ChatWidgetMessage[]>(defaultMessages);
  const [actions, setActions] = useState<ChatbotSuggestedAction[]>([]);
  const [message, setMessage] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [loadingText, setLoadingText] = useState(getActionLoadingText());
  const [inputPlaceholder, setInputPlaceholder] = useState("Nhập câu hỏi...");
  const [flowStatus, setFlowStatus] = useState("");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);
  const runtimeSettings = settingsQuery.data?.value;
  const chatbotOnline = Boolean(
    settingsQuery.data?.isActive &&
    (runtimeSettings?.aiEnabled ||
      runtimeSettings?.faqEnabled ||
      runtimeSettings?.fallbackEnabled),
  );
  const chatbotStatusText = settingsQuery.isLoading
    ? "Đang kiểm tra trạng thái"
    : chatbotOnline
      ? "Đang sẵn sàng hỗ trợ"
      : "Chatbot đang tạm tắt";

  useEffect(() => {
    const closeChatbot = () => setOpen(false);
    window.addEventListener(PUBLIC_CHATBOT_CLOSE_EVENT, closeChatbot);
    return () => window.removeEventListener(PUBLIC_CHATBOT_CLOSE_EVENT, closeChatbot);
  }, []);

  useEffect(() => {
    setPublicFloatingPanelVisibility(open);
    return () => setPublicFloatingPanelVisibility(false);
  }, [open]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedChat = readStoredChat();
      if (storedChat.sessionId) setSessionId(storedChat.sessionId);
      if (storedChat.draft) setDraft(storedChat.draft);
      if (storedChat.messages?.length) setMessages(storedChat.messages);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ sessionId, draft, messages }),
    );
  }, [draft, hydrated, messages, sessionId]);

  useEffect(() => {
    if (!open) return;

    window.setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 0);
  }, [messages, open, sending, flowStatus]);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSuggestionIndex(
        (current) => (current + 1) % chatbotSuggestionMessages.length,
      );
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleActionSideEffect = (
    action: ChatbotSuggestedAction,
    nextDraft?: ChatBookingDraft,
  ) => {
    if (typeof window === "undefined") return;

    if (action.type === "LOOKUP_APPOINTMENT") {
      window.setTimeout(() => {
        window.location.href = "/appointments/lookup";
      }, 450);
      return;
    }

    if (action.type === "START_BOOKING") {
      window.setTimeout(() => {
        window.location.href = buildBookingHref(action, nextDraft || draft);
      }, 450);
      return;
    }

    if (action.type === "CONTACT_STAFF") {
      window.dispatchEvent(new Event("open-consultation-request"));
      window.setTimeout(() => {
        document
          .getElementById("consultation")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }

    if (action.type === "CHANGE_DATE" || action.type === "CHANGE_DOCTOR") {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const sendMessage = async (
    content: string,
    action?: ChatbotSuggestedAction,
  ) => {
    const trimmed = content.trim();
    if (!trimmed || sending || sendingRef.current) return;

    if (!chatbotOnline) {
      setError(
        "Chatbot đang tạm tắt. Vui lòng gửi yêu cầu tư vấn để nhân viên hỗ trợ.",
      );
      return;
    }

    sendingRef.current = true;

    if (!action) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "user",
          content: trimmed,
        },
      ]);
    }
    setActions([]);
    setMessage("");
    setInputPlaceholder(getActionInputPlaceholder(action));
    setLoadingText(getActionLoadingText(action));
    setError("");
    setSending(true);

    try {
      const result = await apiRequest<ChatbotMessageResponse>(
        "/chatbot/message",
        {
          method: "POST",
          body: {
            sessionId,
            message: trimmed,
            draft,
            action: action
              ? {
                  type: action.type,
                  label: action.label,
                  payload: action.payload,
                }
              : undefined,
          },
        },
      );

      setSessionId(result.sessionId);
      setDraft(result.draft);
      setFlowStatus(getFlowStatusText(result.state, result.nextStep));
      setActions(result.suggestedActions || []);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: result.state === "EMERGENCY_CARE" ? "alert" : "assistant",
          source: result.source,
          content: result.reply,
          results: result.results || [],
        },
      ]);
      if (action) handleActionSideEffect(action, result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được tin nhắn");
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          source: "FALLBACK",
          content:
            "Tôi chưa xử lý được yêu cầu này. Bạn thử lại sau một chút nhé.",
        },
      ]);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(message);
  };

  const resetChat = () => {
    setSessionId(undefined);
    setDraft(undefined);
    setMessages(defaultMessages);
    setActions([]);
    setMessage("");
    setFlowStatus("");
    setInputPlaceholder("Nhập câu hỏi...");
    setError("");
    window.localStorage.removeItem(storageKey);
  };

  const latestAssistantMessage = [...messages]
    .reverse()
    .find((item) => item.role === "assistant" || item.role === "alert");
  const resultActionTypes = new Set<string>(
    (latestAssistantMessage?.results || []).map((group) => {
      if (group.type === "departments") return "VIEW_DEPARTMENT";
      if (group.type === "packages") return "VIEW_PACKAGE";
      if (group.type === "doctors") return "VIEW_DOCTOR";
      return "VIEW_AVAILABLE_SLOTS";
    }),
  );
  const visibleActions = actions.filter(
    (action) => !resultActionTypes.has(action.type),
  );

  return (
    <div className="public-floating-utility fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[70] sm:bottom-24 sm:right-6">
      {open ? (
        <section role="dialog" aria-modal="true" aria-labelledby="chatbot-title" className="flex h-[min(620px,calc(100dvh_-_2rem_-_env(safe-area-inset-bottom)))] w-[min(400px,calc(100vw_-_1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-white shadow-2xl ring-1 ring-[var(--public-primary-soft)]">
          <header className="flex items-center justify-between border-b border-[var(--public-divider)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                <Bot className="h-5 w-5" aria-hidden="true" />
                <span
                  className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-white ${chatbotOnline ? "bg-[var(--public-success)]" : "bg-[var(--public-muted)]"}`}
                  aria-hidden="true"
                  title={chatbotStatusText}
                />
              </div>
              <div className="min-w-0">
                <h2 id="chatbot-title" className="truncate text-sm font-semibold text-[var(--public-ink)]">
                  Trợ lý đặt lịch
                </h2>
                <p className="truncate text-xs text-[var(--public-muted)]">
                  {chatbotStatusText}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]"
                aria-label="Tạo cuộc trò chuyện mới"
                title="Tạo cuộc trò chuyện mới"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]"
                aria-label="Đóng chatbot"
                title="Đóng chatbot"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {flowStatus ? (
            <div className="border-b border-[var(--public-divider)] bg-[var(--public-info-soft)] px-4 py-2 text-xs font-semibold text-[var(--public-info)]" role="status">
              {flowStatus}
            </div>
          ) : null}

          <div className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto bg-[var(--public-canvas)] px-4 py-4" aria-live="polite">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`flex ${
                  item.role === "user"
                    ? "justify-end"
                    : item.role === "system" || item.role === "alert"
                      ? "justify-center"
                      : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[94%] rounded-md px-3 py-2 text-sm leading-6 ${
                    item.role === "user"
                      ? "bg-[var(--public-primary)] text-white"
                      : item.role === "system"
                        ? "rounded-full border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--public-primary-dark)]"
                        : item.role === "alert"
                          ? "ui-status-warning border"
                          : "border border-[var(--public-border)] bg-white text-[var(--public-ink)]"
                  }`}
                >
                  {item.role === "assistant" || item.role === "alert" ? (
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide opacity-70">
                      {getResponseSourceLabel(item.source)}
                    </span>
                  ) : null}
                  {item.content}
                  {item.role === "assistant" ? (
                    <ChatbotResultCards
                      groups={item.results}
                      disabled={sending}
                      onAction={(slotAction) =>
                        void sendMessage(slotAction.label, slotAction)
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex items-center gap-2 text-xs text-[var(--public-muted)]" role="status">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
                {loadingText}
              </div>
            ) : null}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-[var(--public-divider)] bg-white p-3">
            {visibleActions.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {visibleActions.map((action, index) => (
                  <button
                    key={getActionRenderKey(action, index)}
                    type="button"
                    disabled={!chatbotOnline || sending}
                    onClick={() => void sendMessage(action.label, action)}
                    className="min-h-10 max-w-full rounded-xl border border-[var(--public-border)] px-3 py-2 text-xs font-medium text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)] disabled:opacity-60"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? (
              <p className="mb-2 text-xs text-[var(--public-danger)]" role="alert">{error}</p>
            ) : null}
            <form className="flex gap-2" onSubmit={submitMessage}>
              <input
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={inputPlaceholder}
                disabled={!chatbotOnline}
                className="ui-field min-w-0 flex-1 px-3 py-2 text-base disabled:bg-[var(--public-surface-muted)] disabled:text-[var(--public-muted)] sm:text-sm"
                aria-label="Nội dung gửi trợ lý"
              />
              <button
                type="submit"
                disabled={!chatbotOnline || sending || !message.trim()}
                className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Gửi
              </button>
            </form>
          </div>
        </section>
      ) : (
        <div className="flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event(PUBLIC_CONSULTATION_CLOSE_EVENT));
              setOpen(true);
            }}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          >
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--public-primary)]">
              Trợ lý
            </span>
            {chatbotSuggestionMessages[suggestionIndex]}
          </button>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event(PUBLIC_CONSULTATION_CLOSE_EVENT));
              setOpen(true);
            }}
            className={`group relative flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[var(--public-primary-soft)] sm:h-14 sm:w-14 sm:px-0 ${chatbotOnline ? "bg-[var(--public-primary)] hover:bg-[var(--public-primary-hover)]" : "bg-[#64748b] hover:bg-[#475569]"}`}
            aria-label="Mở trợ lý"
            title={chatbotStatusText}
          >
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[var(--public-primary)] shadow-md">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <Bot
              className="relative h-6 w-6 transition group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="text-xs font-bold sm:sr-only">Trợ lý AI</span>
          </button>
        </div>
      )}
    </div>
  );
}

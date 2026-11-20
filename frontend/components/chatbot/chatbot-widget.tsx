"use client";

import { RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatbotSuggestedAction } from "@/lib/types";
import { BookingCard } from "@/components/chatbot/booking-card";
import { ChatComposer } from "@/components/chatbot/chat-composer";
import { ChatMessage } from "@/components/chatbot/chat-message";
import { ChatProgress } from "@/components/chatbot/chat-progress";
import { ChatTyping } from "@/components/chatbot/chat-typing";
import { ChatbotLauncher } from "@/components/chatbot/chatbot-launcher";
import { KunAvatar } from "@/components/chatbot/kun-avatar";
import { useChatbot } from "@/components/chatbot/use-chatbot";
import { useDialogA11y } from "@/components/chatbot/use-dialog-a11y";
import { buildBookingHref } from "@/lib/chatbot-ui";
import { usePublicChatbotSettings } from "@/lib/public-chatbot-query";
import { PUBLIC_CHATBOT_CLOSE_EVENT, PUBLIC_CHATBOT_OPEN_EVENT, setPublicFloatingPanelVisibility } from "@/lib/public-ui-events";

// Trợ lý ảo Kun trên website công khai: nút nổi và khung trò chuyện. Logic ở use-chatbot, từng phần giao diện ở các tệp cùng thư mục.
export function ChatbotWidget() {
  const router = useRouter();
  const settingsQuery = usePublicChatbotSettings();
  const runtime = settingsQuery.data?.value;
  const online = Boolean(settingsQuery.data?.isActive && (runtime?.aiEnabled || runtime?.faqEnabled || runtime?.fallbackEnabled));
  const statusText = settingsQuery.isLoading ? "Đang kiểm tra trạng thái" : online ? "Đang sẵn sàng hỗ trợ" : "Đang tạm nghỉ";

  const chat = useChatbot({ online });
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useDialogA11y(open, dialogRef, close);

  // Mở khung chat; bấm nút trong tin nổi thì gửi luôn yêu cầu đó, khỏi bắt người dùng gõ.
  const openChat = (start?: ChatbotSuggestedAction) => {
    setOpen(true);
    if (start) chat.pick(start);
  };

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener(PUBLIC_CHATBOT_OPEN_EVENT, openChat);
    window.addEventListener(PUBLIC_CHATBOT_CLOSE_EVENT, close);
    return () => {
      window.removeEventListener(PUBLIC_CHATBOT_OPEN_EVENT, openChat);
      window.removeEventListener(PUBLIC_CHATBOT_CLOSE_EVENT, close);
    };
  }, [close]);

  useEffect(() => {
    setPublicFloatingPanelVisibility(open);
    return () => setPublicFloatingPanelVisibility(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Luôn cuộn tới tin mới nhất khi có tin mới hoặc Kun đang trả lời.
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.sending, open]);

  const latest = [...chat.messages].reverse().find((item) => item.role === "assistant" || item.role === "alert");
  const mood = chat.sending ? "thinking" : latest?.role === "alert" ? "alert" : "idle";

  return (
    <div className="public-floating-utility fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[70] sm:bottom-6 sm:right-6">
      {open ? (
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kun-title"
          className="kun-panel flex h-[min(640px,calc(100dvh-2rem-env(safe-area-inset-bottom)))] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--public-border)] bg-white shadow-2xl ring-1 ring-[var(--public-primary-soft)] max-sm:fixed max-sm:inset-0 max-sm:h-dvh max-sm:w-screen max-sm:rounded-none"
        >
          <header className="flex items-center justify-between gap-2 border-b border-[var(--public-divider)] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <KunAvatar mood={mood} size={38} />
              <div className="min-w-0">
                <h2 id="kun-title" className="truncate text-sm font-semibold text-[var(--public-ink)]">
                  Kun
                </h2>
                <p className="flex items-center gap-1.5 truncate text-xs text-[var(--public-muted)]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-[var(--public-success)]" : "bg-[var(--public-muted)]"}`} aria-hidden="true" />
                  Trợ lý ảo · {statusText}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={chat.reset}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]"
                aria-label="Bắt đầu cuộc trò chuyện mới"
                title="Bắt đầu lại"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={close}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <ChatProgress summary={chat.draftSummary} disabled={chat.sending} onClear={chat.clearSelection} />

          <div className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto bg-[var(--public-canvas)] px-3 py-4" aria-live="polite">
            {chat.messages.map((item) => (
              <ChatMessage
                key={item.id}
                message={item}
                selectedSlotId={chat.draftSummary?.slot?.id}
                disabled={chat.sending || !online}
                isLatest={item.id === chat.messages[chat.messages.length - 1]?.id && !chat.sending}
                onAction={chat.pick}
                onRetry={chat.retry}
              />
            ))}
            {chat.sending ? <ChatTyping text={chat.loadingText} /> : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-[var(--public-divider)] bg-white pt-2">
            <BookingCard summary={chat.draftSummary} onContinue={() => router.push(buildBookingHref(chat.draft))} />
            {chat.notice ? (
              <p className="px-3 pb-2 text-xs text-[var(--public-danger)]" role="alert">
                {chat.notice}
              </p>
            ) : null}
            <ChatComposer ref={inputRef} placeholder={chat.placeholder} disabled={!online} sending={chat.sending} onSend={(text) => void chat.send(text)} />
          </div>
        </section>
      ) : (
        <ChatbotLauncher online={online} statusText={statusText} onOpen={openChat} />
      )}
    </div>
  );
}

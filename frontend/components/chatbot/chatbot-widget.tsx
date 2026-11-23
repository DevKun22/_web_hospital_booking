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
import { WaveEdge } from "@/components/public/wave-edge";
import { buildBookingHref } from "@/lib/chatbot-ui";
import { usePublicChatbotSettings } from "@/lib/public-chatbot-query";
import { usePublicSiteSettings } from "@/lib/public-bootstrap-client";
import { PUBLIC_CHATBOT_CLOSE_EVENT, PUBLIC_CHATBOT_OPEN_EVENT, setPublicFloatingPanelVisibility } from "@/lib/public-ui-events";

// Trợ lý ảo Kun trên website công khai: nút nổi và khung trò chuyện. Logic ở use-chatbot, từng phần giao diện ở các tệp cùng thư mục.
export function ChatbotWidget() {
  const router = useRouter();
  const settingsQuery = usePublicChatbotSettings();
  const runtime = settingsQuery.data?.value;
  const online = Boolean(settingsQuery.data?.isActive && (runtime?.aiEnabled || runtime?.faqEnabled || runtime?.fallbackEnabled));
  const statusText = settingsQuery.isLoading ? "Đang kiểm tra trạng thái" : online ? "Đang sẵn sàng hỗ trợ" : "Đang tạm nghỉ";

  const siteSettings = usePublicSiteSettings();
  const contact = { hotline: siteSettings.data?.hotline, email: siteSettings.data?.email };
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

  // Sự kiện mở có thể kèm yêu cầu cần gửi ngay; dùng bản `pick` mới nhất qua ref để không phải nghe lại sự kiện mỗi lần render.
  const pickRef = useRef(chat.pick);
  useEffect(() => {
    pickRef.current = chat.pick;
  }, [chat.pick]);

  useEffect(() => {
    const openChat = (event: Event) => {
      setOpen(true);
      const start = (event as CustomEvent<ChatbotSuggestedAction | undefined>).detail;
      if (start) pickRef.current(start);
    };
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
          className="kun-panel flex h-[min(640px,calc(100dvh-2rem-env(safe-area-inset-bottom)))] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-white shadow-2xl ring-1 ring-[var(--public-primary-soft)] max-sm:fixed max-sm:inset-0 max-sm:h-dvh max-sm:w-screen max-sm:rounded-none"
        >
          <header className="relative flex items-center justify-between gap-2 overflow-hidden bg-[var(--public-solid)] px-4 pb-5 pt-2.5 text-white">
            <div className="relative z-10 flex min-w-0 items-center gap-2.5">
              <span className="rounded-full bg-white p-0.5"><KunAvatar mood={mood} size={36} /></span>
              <div className="min-w-0">
                <h2 id="kun-title" className="truncate text-sm font-semibold text-white">
                  Kun
                </h2>
                <p className="flex items-center gap-1.5 truncate text-xs text-white/85">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-[var(--footer-accent)]" : "bg-white/50"}`} aria-hidden="true" />
                  Trợ lý ảo · {statusText}
                </p>
              </div>
            </div>
            <div className="relative z-10 flex items-center">
              <button
                type="button"
                onClick={chat.reset}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                aria-label="Bắt đầu cuộc trò chuyện mới"
                title="Bắt đầu lại"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={close}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <WaveEdge fill="var(--public-canvas)" />
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
                onRate={chat.rate}
                contact={contact}
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

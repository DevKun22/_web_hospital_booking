import { AlertTriangle, FileText, Phone, RotateCcw } from "lucide-react";
import Link from "next/link";
import { ChatbotResultCards } from "@/components/chatbot/result-cards";
import { KunAvatar } from "@/components/chatbot/kun-avatar";
import type { ChatWidgetMessage } from "@/lib/chatbot-ui";
import type { ChatbotSuggestedAction } from "@/lib/types";

/** Số cấp cứu y tế toàn quốc. */
const EMERGENCY_NUMBER = "115";

type Props = {
  message: ChatWidgetMessage;
  selectedSlotId?: string;
  disabled?: boolean;
  onAction: (action: ChatbotSuggestedAction) => void;
  onRetry: () => void;
};

// Một tin trong cuộc trò chuyện: người dùng (bên phải), Kun (bên trái, kèm nguồn và thẻ kết quả), thông báo hệ thống (viên thuốc),
// và cảnh báo cấp cứu (thẻ đỏ có nút gọi).
export function ChatMessage({ message, selectedSlotId, disabled, onAction, onRetry }: Props) {
  if (message.role === "system") {
    return (
      <div className="kun-enter flex justify-center">
        <span className="rounded-full border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--public-primary-dark)]">{message.content}</span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="kun-enter flex justify-end">
        <p className="max-w-[85%] rounded-xl rounded-br-sm bg-[var(--public-primary)] px-3 py-2 text-sm leading-6 text-white">{message.content}</p>
      </div>
    );
  }

  if (message.role === "alert") {
    return (
      <div className="kun-enter flex items-end gap-2">
        <KunAvatar mood="alert" size={28} />
        <div className="max-w-[88%] rounded-xl rounded-bl-sm border border-[var(--public-danger)] bg-[var(--public-danger-soft)] p-3 text-sm leading-6 text-[var(--public-danger)]" role="alert">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Cần hỗ trợ khẩn cấp
          </p>
          <p className="mt-1">{message.content}</p>
          <a
            href={`tel:${EMERGENCY_NUMBER}`}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--public-danger)] px-3 text-sm font-semibold text-white"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Gọi cấp cứu {EMERGENCY_NUMBER}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="kun-enter flex items-end gap-2">
      <KunAvatar size={28} />
      <div className="min-w-0 max-w-[88%] rounded-xl rounded-bl-sm border border-[var(--public-border)] bg-white px-3 py-2 text-sm leading-6 text-[var(--public-ink)]">
        <p className="whitespace-pre-line">{message.content}</p>
        <ChatbotResultCards groups={message.results} selectedSlotId={selectedSlotId} disabled={disabled} onAction={onAction} />
        {message.sources?.length ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-[var(--public-divider)] pt-1.5 text-[11px] text-[var(--public-muted)]">
            <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Theo:</span>
            {message.sources.slice(0, 2).map((source, index) =>
              source.url ? (
                <Link key={source.id} href={source.url} className="font-medium text-[var(--public-primary)] underline-offset-2 hover:underline">
                  {source.title}
                  {index < Math.min(message.sources!.length, 2) - 1 ? "," : ""}
                </Link>
              ) : (
                <span key={source.id}>{source.title}</span>
              ),
            )}
          </p>
        ) : null}
        {message.retryable ? (
          <button type="button" onClick={onRetry} disabled={disabled} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--public-border)] px-3 text-xs font-medium text-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] disabled:opacity-60">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Thử lại
          </button>
        ) : null}
      </div>
    </div>
  );
}

import { AlertTriangle, FileText, Phone, RotateCcw } from "lucide-react";
import Link from "next/link";
import { FollowUps } from "@/components/chatbot/follow-ups";
import { ChatbotResultCards } from "@/components/chatbot/result-cards";
import { KunAvatar } from "@/components/chatbot/kun-avatar";
import { getQuickReplies, type ChatWidgetMessage } from "@/lib/chatbot-ui";
import type { ChatbotSuggestedAction } from "@/lib/types";

/** Số cấp cứu y tế toàn quốc. */
const EMERGENCY_NUMBER = "115";

type Props = {
  message: ChatWidgetMessage;
  selectedSlotId?: string;
  disabled?: boolean;
  /** Tin mới nhất: chỉ tin này hiện gợi ý bước tiếp theo, tin cũ để lại như lịch sử. */
  isLatest?: boolean;
  onAction: (action: ChatbotSuggestedAction) => void;
  onRetry: () => void;
};

// Một tin trong cuộc trò chuyện: người dùng (bên phải), Kun (bên trái, kèm nguồn và thẻ kết quả), thông báo hệ thống (viên thuốc),
// và cảnh báo cấp cứu (thẻ đỏ có nút gọi).
export function ChatMessage({ message, selectedSlotId, disabled, isLatest, onAction, onRetry }: Props) {
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
          <p className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--public-divider)] pt-2 text-[11px] text-[var(--public-muted)]">
            <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Nguồn:</span>
            {message.sources.slice(0, 3).map((source) =>
              source.url ? (
                <Link
                  key={source.id}
                  href={source.url}
                  className="rounded-full border border-[var(--public-border)] bg-[var(--public-surface-muted)] px-2 py-0.5 font-medium text-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]"
                >
                  {source.title}
                </Link>
              ) : (
                <span key={source.id} className="rounded-full border border-[var(--public-border)] px-2 py-0.5">
                  {source.title}
                </span>
              ),
            )}
          </p>
        ) : null}
        {isLatest && !message.retryable ? (
          <FollowUps
            actions={getQuickReplies(message.actions || [], message.results)}
            disabled={disabled}
            variant={message.id === "welcome" ? "grid" : "list"}
            title={message.id === "welcome" ? undefined : "Bạn có thể hỏi tiếp"}
            onPick={onAction}
          />
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

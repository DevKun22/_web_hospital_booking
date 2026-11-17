"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getKunTeaser } from "@/lib/chatbot-ui";
import type { ChatbotSuggestedAction } from "@/lib/types";
import { KunAvatar } from "./kun-avatar";

const TEASER_KEY = "kun-teaser-seen";
const TEASER_DELAY_MS = 3000;
const TEASER_VISIBLE_MS = 14000;

// Nút nổi mở trợ lý. Một lần mỗi phiên duyệt web Kun nổi một tin nhắn theo trang đang xem (kèm vài nút hỏi ngay), nhún nhẹ và có
// chấm báo "1 tin mới" cho tới khi người dùng mở khung chat. Tin tự ẩn sau ít giây (đứng yên khi rê chuột hay đang tập trung vào nó),
// tắt được, không bật lại trong phiên và không xuất hiện ở trang biểu mẫu hay thanh toán.
export function ChatbotLauncher({
  online,
  statusText,
  onOpen,
}: {
  online: boolean;
  statusText: string;
  onOpen: (start?: ChatbotSuggestedAction) => void;
}) {
  const pathname = usePathname();
  const teaserContent = getKunTeaser(pathname);
  const [teaser, setTeaser] = useState(false);
  const [unread, setUnread] = useState(false);
  const [paused, setPaused] = useState(false);
  const eligible = online && Boolean(teaserContent);

  useEffect(() => {
    if (!eligible) return;
    try {
      if (window.sessionStorage.getItem(TEASER_KEY)) return;
    } catch {
      return;
    }
    const show = window.setTimeout(() => {
      setTeaser(true);
      setUnread(true);
      try {
        window.sessionStorage.setItem(TEASER_KEY, "1");
      } catch {
        // Không ghi được thì tin có thể hiện lại ở trang sau, không sao.
      }
    }, TEASER_DELAY_MS);
    return () => window.clearTimeout(show);
  }, [eligible]);

  useEffect(() => {
    if (!teaser || paused) return;
    const hide = window.setTimeout(() => setTeaser(false), TEASER_VISIBLE_MS);
    return () => window.clearTimeout(hide);
  }, [teaser, paused]);

  // Sang trang biểu mẫu hay thanh toán thì tin nổi và chấm báo tự ẩn (suy ra từ trang, không cần đặt lại trạng thái).
  const showTeaser = teaser && Boolean(teaserContent);
  const showUnread = unread && Boolean(teaserContent);

  return (
    <div className="flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {showTeaser && teaserContent ? (
        <div
          className="kun-rise relative max-w-[17rem] rounded-xl rounded-br-sm border border-[var(--public-border)] bg-white p-3 pr-8 text-sm text-[var(--public-ink)] shadow-xl"
          role="status"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <p className="leading-5">{teaserContent.message}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {teaserContent.chips.map((chip) => (
              <li key={chip.type}>
                <button
                  type="button"
                  onClick={() => onOpen(chip)}
                  className="min-h-9 rounded-full border border-[var(--public-primary)] bg-[var(--public-primary-soft)] px-3 text-xs font-semibold text-[var(--public-primary-dark)] transition hover:bg-white"
                >
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setTeaser(false)}
            className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]"
            aria-label="Ẩn lời chào"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onOpen()}
        className={`kun-launcher relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg shadow-black/20 ring-2 transition focus:outline-none focus:ring-4 ${online ? "ring-[var(--dk-teal)] focus:ring-[var(--public-primary-soft)]" : "opacity-70 ring-[var(--public-border)]"} ${showUnread ? "kun-ping" : ""}`}
        aria-label={showUnread ? "Trò chuyện với Kun, trợ lý ảo, có 1 tin nhắn mới" : "Trò chuyện với Kun, trợ lý ảo"}
        title={statusText}
      >
        <KunAvatar size={40} />
        {showUnread ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--public-danger)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            aria-hidden="true"
          >
            1
          </span>
        ) : null}
      </button>
    </div>
  );
}

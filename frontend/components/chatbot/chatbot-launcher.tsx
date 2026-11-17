"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { KunAvatar } from "./kun-avatar";

const TEASER_KEY = "kun-teaser-seen";
const TEASER_DELAY_MS = 3500;
const TEASER_VISIBLE_MS = 8000;

// Nút nổi mở trợ lý: Kun nhún nhẹ, và một lần mỗi phiên duyệt web có lời chào nhỏ để người dùng biết đây là trợ lý
// (không tự bật lại sau khi đã thấy, và tắt được).
export function ChatbotLauncher({ online, statusText, onOpen }: { online: boolean; statusText: string; onOpen: () => void }) {
  const [teaser, setTeaser] = useState(false);

  useEffect(() => {
    if (!online) return;
    try {
      if (window.sessionStorage.getItem(TEASER_KEY)) return;
    } catch {
      return;
    }
    const show = window.setTimeout(() => {
      setTeaser(true);
      try {
        window.sessionStorage.setItem(TEASER_KEY, "1");
      } catch {
        // Không ghi được thì lời chào có thể hiện lại ở trang sau, không sao.
      }
    }, TEASER_DELAY_MS);
    const hide = window.setTimeout(() => setTeaser(false), TEASER_DELAY_MS + TEASER_VISIBLE_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [online]);

  return (
    <div className="flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {teaser ? (
        <div className="kun-rise relative max-w-[15rem] rounded-xl rounded-br-sm border border-[var(--public-border)] bg-white py-2 pl-3 pr-8 text-sm text-[var(--public-ink)] shadow-lg" role="status">
          Chào bạn, mình là Kun. Cần tìm bác sĩ hay đặt lịch, cứ hỏi mình nhé.
          <button
            type="button"
            onClick={() => setTeaser(false)}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]"
            aria-label="Ẩn lời chào"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className={`kun-launcher flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg shadow-black/20 ring-2 transition focus:outline-none focus:ring-4 ${online ? "ring-[var(--dk-teal)] focus:ring-[var(--public-primary-soft)]" : "opacity-70 ring-[var(--public-border)]"}`}
        aria-label="Trò chuyện với Kun, trợ lý ảo"
        title={statusText}
      >
        <KunAvatar size={40} />
      </button>
    </div>
  );
}

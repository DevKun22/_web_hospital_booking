"use client";

import { useEffect, useState } from "react";
import { SLOW_LOADING_TEXT } from "@/lib/chatbot-ui";
import { KunAvatar } from "./kun-avatar";

/** Sau ngần này Kun nói thật là đang lâu hơn bình thường. */
const SLOW_AFTER_MS = 4000;

// Chỉ báo "Kun đang nghĩ": linh vật nghĩ + ba chấm nhún + lời nhắn theo việc đang làm. Có role=status để trình đọc màn hình biết.
export function ChatTyping({ text }: { text: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="kun-enter flex items-end gap-2" role="status" aria-live="polite">
      <KunAvatar mood="thinking" size={28} />
      <div className="rounded-xl rounded-bl-sm border border-[var(--public-border)] bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-[var(--public-text-soft)]">
          <span className="kun-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{slow ? SLOW_LOADING_TEXT : text}</span>
        </div>
      </div>
    </div>
  );
}

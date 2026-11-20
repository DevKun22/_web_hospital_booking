"use client";

import { MessageCircleQuestion } from "lucide-react";
import { openPublicChatbot } from "@/lib/public-ui-events";

// Nút "Hỏi Kun" ở dải mời đặt lịch đầu footer.
export function FooterAskKun() {
  return (
    <button
      type="button"
      onClick={() => openPublicChatbot()}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/70 px-5 text-base font-semibold text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
      Hỏi Kun
    </button>
  );
}

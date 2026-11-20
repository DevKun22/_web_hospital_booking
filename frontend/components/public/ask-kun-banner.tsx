"use client";

import { MessageCircleQuestion } from "lucide-react";
import { openPublicChatbot } from "@/lib/public-ui-events";

// Dải mời hỏi Kun dưới danh sách chuyên khoa: lối vào cho người chưa biết nên khám khoa nào.
export function AskKunBanner() {
  return (
    <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[var(--public-primary-soft)] p-5 sm:flex-row sm:items-center sm:p-6">
      <div>
        <p className="text-base font-semibold text-[var(--public-primary-dark)]">Chưa biết nên khám khoa nào?</p>
        <p className="mt-1 text-sm text-[var(--public-text-soft)]">Mô tả triệu chứng, Kun gợi ý chuyên khoa phù hợp để bạn tham khảo.</p>
      </div>
      <button
        type="button"
        onClick={() => openPublicChatbot()}
        className="public-button-primary inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-6 text-base font-semibold"
      >
        <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
        Hỏi Kun
      </button>
    </div>
  );
}

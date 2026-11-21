"use client";

import { MessageCircleQuestion } from "lucide-react";
import { openPublicChatbot } from "@/lib/public-ui-events";

// Nút "Hỏi Kun" dạng viền trên nền sáng (cột đặt lịch ở trang chi tiết); bản trên nền xanh footer nằm ở footer-ask-kun.tsx.
export function AskKunButton({ label = "Hỏi Kun" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => openPublicChatbot()}
      className="public-button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
    >
      <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

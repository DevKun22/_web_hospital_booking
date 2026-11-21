"use client";

import { Sparkles } from "lucide-react";
import { buildSummarizeArticleAction } from "@/lib/chatbot-ui";
import { openPublicChatbot } from "@/lib/public-ui-events";

// Nút ở đầu bài viết: mở Kun và nhờ tóm tắt đúng bài này. Bài dài, người đọc muốn nắm ý chính trước khi đọc kỹ hoặc trước khi quyết định đặt lịch.
export function SummarizeWithKun({ slug }: { slug: string }) {
  return (
    <button
      type="button"
      onClick={() => openPublicChatbot(buildSummarizeArticleAction(slug))}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--public-primary)] bg-[var(--public-surface)] px-4 text-sm font-semibold text-[var(--public-primary)] transition hover:bg-[var(--public-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)]"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      Tóm tắt bài này với Kun
    </button>
  );
}

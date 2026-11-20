import { prisma } from "../../../config/prisma.js";
import { logger } from "../../../observability/logger.js";
import type { AIChatbotOutput, ChatBookingDraft, ChatbotResponseSource, SuggestedAction } from "../chatbot.types.js";
import { summarizeArticleText } from "../rag/generator.js";
import KnowledgeService from "../rag/knowledge.service.js";
import { TtlCache } from "../rag/ttl-cache.js";
import { vary } from "../rules/variants.js";
import { withFocus } from "./follow-up.js";

// Tóm tắt một bài viết kiến thức theo yêu cầu của người đọc (nút "Tóm tắt với Kun" ở trang bài viết).
// Đọc thẳng nội dung bài đã xuất bản trong DB (không qua truy hồi nên không lẫn bài khác); AI không dùng được hoặc kết quả không đáng tin
// (thêm số liệu ngoài bài) thì dùng bản tóm tắt dựng từ chính bài: đoạn mô tả và các mục.

type SummaryResult = { output: AIChatbotOutput; source: ChatbotResponseSource };

const HEALTH_DISCLAIMER = "Đây là thông tin tham khảo, không thay thế tư vấn của bác sĩ.";
const MAX_FALLBACK_HEADINGS = 6;
const FALLBACK_LEAD_CHARS = 320;

const cache = new TtlCache<SummaryResult>(60, 30 * 60_000);

const headingsOf = (markdown: string) =>
  [...markdown.matchAll(/^#{2,3}\s+(.+?)\s*#*\s*$/gm)].map((match) => match[1].trim()).filter(Boolean);

const plainLead = (markdown: string) => {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map((part) => part.replace(/^#{1,6}\s+.*$/gm, "").replace(/[*_`>#-]/g, "").replace(/\s+/g, " ").trim())
    .find((part) => part.length >= 40);
  return paragraph ? paragraph.slice(0, FALLBACK_LEAD_CHARS).trim() : "";
};

/** Bản tóm tắt không cần AI: đoạn mô tả của bài (hoặc đoạn mở đầu) và các mục chính. */
export const fallbackSummary = (article: { title: string; summary: string | null; content: string }) => {
  const lead = article.summary?.trim() || plainLead(article.content);
  const headings = headingsOf(article.content).slice(0, MAX_FALLBACK_HEADINGS);
  const parts = [lead ? `• ${lead}` : "", headings.length ? `• Bài gồm các mục: ${headings.join(", ")}.` : ""].filter(Boolean);
  return parts.length ? parts.join("\n") : `• Bài "${article.title}" chưa có đủ nội dung để tóm tắt, bạn mở bài để đọc nhé.`;
};

class ArticleSummaryFlow {
  async summarize(input: { slug: string; draft: ChatBookingDraft; aiEnabled: boolean; model?: string }): Promise<SummaryResult | null> {
    const article = await prisma.article.findFirst({
      where: { slug: input.slug, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        content: true,
        updatedAt: true,
        reviewerName: true,
        reviewedAt: true,
        department: { select: { id: true, name: true } },
      },
    });
    if (!article) return null;

    const version = KnowledgeService.version;
    const key = `${article.id}|${article.updatedAt.getTime()}|${input.aiEnabled ? 1 : 0}|${input.model ?? ""}`;
    const hit = cache.get(key, version);
    if (hit) return { ...hit, output: { ...hit.output, draft: withFocus(input.draft, hit.output.draft.focus) } };

    let aiSummary: string | null = null;
    if (input.aiEnabled) {
      aiSummary = await summarizeArticleText({ title: article.title, content: article.content, model: input.model }).catch((error) => {
        logger.warn("[CHATBOT_RAG] Không gọi được AI để tóm tắt bài, dùng bản dựng từ bài:", error);
        return null;
      });
    }
    const summary = aiSummary ?? fallbackSummary(article);
    const intro = vary([`Mình tóm tắt bài "${article.title}" cho bạn nhé:`, `Đây là những ý chính của bài "${article.title}":`]);

    const actions: SuggestedAction[] = article.department
      ? [
          { type: "ASK_QUESTION", label: "Khi nào nên đi khám?", payload: { question: `Khi nào nên đến khám ${article.department.name}?` } },
          { type: "VIEW_DEPARTMENT", label: `Xem ${article.department.name}`, payload: { departmentId: article.department.id } },
          { type: "START_BOOKING", label: "Đặt lịch khám", payload: { prefill: { departmentId: article.department.id } } },
        ]
      : [
          { type: "VIEW_DEPARTMENTS", label: "Tìm chuyên khoa phù hợp", payload: {} },
          { type: "START_BOOKING", label: "Đặt lịch khám", payload: {} },
        ];

    const result: SummaryResult = {
      output: {
        reply: `${intro}\n${summary}\n${HEALTH_DISCLAIMER}`,
        intent: "GENERAL_HOSPITAL_INFO",
        state: "BOOKING_GUIDE",
        nextStep: "END",
        confidence: aiSummary ? 0.9 : 0.7,
        draft: withFocus(
          input.draft,
          article.department ? { type: "department", id: article.department.id, name: article.department.name, departmentId: article.department.id } : undefined,
        ),
        suggestedActions: actions,
        sources: [
          {
            id: article.id,
            type: "ARTICLE",
            title: article.title,
            url: `/kien-thuc/${article.slug}`,
            ...(article.reviewedAt ? { reviewedBy: article.reviewerName, updatedAt: article.reviewedAt.toISOString() } : {}),
          },
        ],
      },
      source: aiSummary ? "AI" : "SYSTEM",
    };
    // Chỉ nhớ bản do AI tóm tắt; kho đổi phiên bản giữa chừng thì không nhớ.
    if (aiSummary && version === KnowledgeService.version) cache.set(key, result, version);
    return result;
  }
}

export default new ArticleSummaryFlow();

import type { DsTone } from "@/components/ds";
import type { ArticleSummary } from "@/lib/types";

// Giai đoạn của bài viết kiến thức sức khỏe (suy ra từ trạng thái và dấu duyệt, backend không lưu riêng):
//   chờ duyệt → bác sĩ duyệt nội dung → quản trị xuất bản → đã xuất bản.

export type ArticleStage = "PENDING_REVIEW" | "READY" | "PUBLISHED";

export const getArticleStage = (article: Pick<ArticleSummary, "status" | "reviewedAt">): ArticleStage => {
  if (article.status === "PUBLISHED") return "PUBLISHED";
  return article.reviewedAt ? "READY" : "PENDING_REVIEW";
};

export const ARTICLE_STAGE_LABEL: Record<ArticleStage, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  READY: "Đã duyệt, chờ xuất bản",
  PUBLISHED: "Đã xuất bản",
};

export const ARTICLE_STAGE_TONE: Record<ArticleStage, DsTone> = {
  PENDING_REVIEW: "warn",
  READY: "info",
  PUBLISHED: "good",
};

/** Tiêu đề đổi thì đường dẫn tự đổi theo, cho tới khi người dùng sửa tay hoặc bài đã xuất bản lần đầu (khi đó đường dẫn bị khóa). */
export const shouldAutoSlug = (state: { slugTouched: boolean; locked: boolean }) => !state.slugTouched && !state.locked;

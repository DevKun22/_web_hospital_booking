/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BookOpenText, ShieldCheck } from "lucide-react";
import type { ArticleSummary } from "@/lib/types";

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

// Thẻ bài viết: ảnh bìa (hoặc biểu tượng trên nền xanh nhạt khi chưa có ảnh), chuyên mục, tiêu đề, tóm tắt và dấu "bác sĩ duyệt" cùng ngày đăng.
// Biến thể featured là thẻ ngang cho bài mới nhất. Không hiện số phút đọc ở danh sách (không có trong dữ liệu danh sách).
export function ArticleCard({ article, featured = false, index = 0, className = "" }: { article: ArticleSummary; featured?: boolean; index?: number; className?: string }) {
  const category = article.category || "Kiến thức sức khỏe";
  const cover = article.coverImage ? (
    <img src={article.coverImage} alt="" width={featured ? 800 : 640} height={featured ? 450 : 256} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
      <BookOpenText className={featured ? "h-14 w-14" : "h-9 w-9"} aria-hidden="true" />
    </span>
  );
  const meta = (
    <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-sm text-[var(--public-muted)]">
      {article.reviewerName ? (
        <span className="inline-flex items-center gap-1 font-medium text-[var(--public-success)]"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Bác sĩ duyệt</span>
      ) : null}
      {article.publishedAt ? <span>{formatDate(article.publishedAt)}</span> : null}
    </span>
  );
  return (
    <li style={{ "--i": index } as React.CSSProperties} className={`catalog-rise ${className}`}>
      <Link
        href={`/kien-thuc/${article.slug}`}
        className={`group flex h-full overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] transition hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${featured ? "flex-col md:grid md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]" : "flex-col"}`}
      >
        <span className={`block overflow-hidden bg-[var(--public-tint-strong)] ${featured ? "aspect-[5/2] md:aspect-auto md:min-h-[14rem]" : "aspect-[5/2]"}`} aria-hidden="true">{cover}</span>
        <span className="flex flex-1 flex-col p-4">
          <span className="text-sm font-medium text-[var(--public-primary)]">{featured ? `${category} · Bài mới nhất` : category}</span>
          <h2 className={`mt-1 font-semibold leading-snug ${featured ? "text-xl sm:text-2xl" : "text-lg"}`}>{article.title}</h2>
          {article.summary ? <span className={`mt-1.5 text-base leading-7 text-[var(--public-text-soft)] ${featured ? "line-clamp-4" : "line-clamp-2"}`}>{article.summary}</span> : null}
          {meta}
        </span>
      </Link>
    </li>
  );
}

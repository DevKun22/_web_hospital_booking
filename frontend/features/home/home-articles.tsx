/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, BookOpenText, ShieldCheck } from "lucide-react";
import { SummarizeWithKun } from "@/components/public/summarize-with-kun";
import type { ArticleSummary, PublicArticleList } from "@/lib/types";

const MAX_CATEGORIES = 5;
const SIDE_ARTICLES = 3;

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

/** Ô ảnh bìa: bài có ảnh bìa thì hiện ảnh, chưa có thì khối màu nhạt kèm biểu tượng. Ảnh chỉ để minh họa nên alt rỗng (tiêu đề bài ngay bên cạnh). */
function Cover({ ratio, src }: { ratio: string; src?: string | null }) {
  return (
    <div className={`${ratio} flex items-center justify-center overflow-hidden bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]`} aria-hidden="true">
      {src ? <img src={src} alt="" width={800} height={450} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <BookOpenText className="h-10 w-10" />}
    </div>
  );
}

function CategoryTag({ article }: { article: ArticleSummary }) {
  return <span className="rounded-full bg-[var(--public-primary-soft)] px-2.5 py-0.5 text-sm font-medium text-[var(--public-primary-dark)]">{article.category || "Kiến thức sức khỏe"}</span>;
}

function ReviewLine({ article }: { article: ArticleSummary }) {
  if (!article.reviewerName) return null;
  return (
    <p className="flex items-start gap-1.5 text-sm text-[var(--public-success)]">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Duyệt bởi {article.reviewerName}{article.reviewedAt ? `, ${formatDate(article.reviewedAt)}` : ""}</span>
    </p>
  );
}

// Mục kiến thức sức khỏe ở trang chủ: bài mới nhất là thẻ lớn (kèm nút nhờ Kun tóm tắt), ba bài kế tiếp là danh sách ngang. Dữ liệu tải trên máy chủ cùng trang;
// chưa có bài nào được xuất bản thì ẩn hẳn mục.
export function HomeArticles({ articles }: { articles: PublicArticleList | null | undefined }) {
  const items = articles?.items ?? [];
  if (!items.length) return null;
  const [featured, ...rest] = items;
  const side = rest.slice(0, SIDE_ARTICLES);
  const categories = (articles?.categories ?? []).slice(0, MAX_CATEGORIES);
  // Có ảnh bìa: thẻ lớn bên trái, danh sách bên phải. Chưa có ảnh: thẻ lớn gọn ở trên, các bài còn lại xếp ba cột bên dưới để không chừa khoảng trống.
  const hasCover = Boolean(featured.coverImage);

  return (
    <section id="kien-thuc" aria-labelledby="articles-title" className="scroll-mt-24 bg-[var(--public-surface)]">
      <div className="ui-container py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 flex-1 basis-60">
            <h2 id="articles-title" className="text-xl font-bold sm:text-2xl">Kiến thức sức khỏe</h2>
            <span aria-hidden="true" className="mt-2 block h-[3px] w-10 rounded bg-[var(--public-care-mint)]" />
            <p className="mt-2 text-base text-[var(--public-muted)]">Bài viết do bác sĩ biên soạn và duyệt, để bạn tham khảo trước khi đi khám.</p>
          </div>
          <Link href="/kien-thuc" className="shrink-0 py-2 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem tất cả bài viết</Link>
        </div>

        {categories.length ? (
          <nav aria-label="Danh mục bài viết" className="mt-5 flex flex-wrap gap-2">
            {categories.map((item) => (
              <Link
                key={item.name}
                href={`/kien-thuc?category=${encodeURIComponent(item.name)}`}
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--public-border)] px-3.5 text-sm text-[var(--public-text-soft)] transition hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className={`mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 ${side.length && hasCover ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : ""}`}>
          <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm">
            {featured.coverImage ? (
              <Link href={`/kien-thuc/${featured.slug}`} tabIndex={-1} aria-hidden="true" className="block">
                <Cover ratio="aspect-[16/9] lg:aspect-[2/1]" src={featured.coverImage} />
              </Link>
            ) : null}
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--public-muted)]">
                <CategoryTag article={featured} />
                {featured.publishedAt ? <span>{formatDate(featured.publishedAt)}</span> : null}
              </p>
              <h3 className="mt-2 text-xl font-semibold leading-snug text-[var(--public-ink)]">
                <Link href={`/kien-thuc/${featured.slug}`} className="hover:text-[var(--public-primary)]">{featured.title}</Link>
              </h3>
              {featured.summary ? <p className="mt-2 line-clamp-3 text-base leading-7 text-[var(--public-text-soft)]">{featured.summary}</p> : null}
              <div className="mt-3"><ReviewLine article={featured} /></div>
              <div className={`${hasCover ? "mt-auto pt-3" : "mt-3"} flex flex-wrap items-center gap-x-4 gap-y-1`}>
                <Link href={`/kien-thuc/${featured.slug}`} className="public-button-primary inline-flex min-h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-semibold">
                  Đọc bài
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <SummarizeWithKun slug={featured.slug} />
              </div>
            </div>
          </article>

          {side.length ? (
            <ul className={`grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5 ${hasCover ? "" : "md:grid-cols-3"}`}>
              {side.map((article) => (
                <li key={article.id}>
                  <article className="flex h-full items-center gap-4 overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 shadow-sm transition hover:border-[var(--public-primary)] sm:p-4">
                    {hasCover || article.coverImage ? (
                      <Link href={`/kien-thuc/${article.slug}`} tabIndex={-1} aria-hidden="true" className="block w-28 shrink-0 overflow-hidden rounded-xl sm:w-40">
                        <Cover ratio="aspect-[4/3]" src={article.coverImage} />
                      </Link>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--public-muted)]">
                        <CategoryTag article={article} />
                        {article.publishedAt ? <span>{formatDate(article.publishedAt)}</span> : null}
                      </p>
                      <h3 className="mt-1.5 text-lg font-semibold leading-snug text-[var(--public-ink)]">
                        <Link href={`/kien-thuc/${article.slug}`} className="hover:text-[var(--public-primary)]">{article.title}</Link>
                      </h3>
                      {article.reviewerName ? <p className="mt-1.5 truncate text-sm text-[var(--public-success)]">Duyệt bởi {article.reviewerName}</p> : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BookOpenText, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { CatalogHeader } from "@/components/public/catalog-parts";
import { chipClass, FLAT_SEARCH_BUTTON_CLASS, FLAT_SEARCH_INPUT_CLASS } from "@/components/public/chip-styles";
import { serverApiRequest } from "@/lib/server-api";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";
import type { PublicArticleList } from "@/lib/types";

type PageProps = { searchParams: Promise<{ category?: string; page?: string; q?: string }> };

const pageJsonLd = buildCollectionPageJsonLd({
  name: "Kiến thức sức khỏe",
  description: "Bài viết kiến thức sức khỏe do đội ngũ bác sĩ biên soạn và duyệt.",
  path: "/kien-thuc",
});

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

const hrefFor = (params: { category?: string; q?: string; page?: number }) => {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return `/kien-thuc${text ? `?${text}` : ""}`;
};

export default async function KnowledgePage({ searchParams }: PageProps) {
  const { category, q, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);

  let data: PublicArticleList | null = null;
  try {
    data = await serverApiRequest<PublicArticleList>("/articles", {
      query: { category, q, page, limit: 12 },
      next: { revalidate: 300 },
    });
  } catch {
    data = null;
  }

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }} />
      <CatalogHeader current="Kiến thức sức khỏe" title="Kiến thức sức khỏe" description="Bài viết do đội ngũ bác sĩ biên soạn và duyệt. Đây là thông tin tham khảo, không thay thế tư vấn của bác sĩ.">
        <div className="space-y-3">
          <form action="/kien-thuc" method="get" role="search" className="max-w-xl">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label className="relative block">
              <span className="sr-only">Tìm bài viết</span>
              <input name="q" defaultValue={q} placeholder="Tìm bài viết" autoComplete="off" enterKeyHint="search" className={FLAT_SEARCH_INPUT_CLASS} />
              <button type="submit" aria-label="Tìm kiếm" className={FLAT_SEARCH_BUTTON_CLASS}>
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            </label>
          </form>
          {data?.categories.length ? (
            <nav aria-label="Danh mục bài viết" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <Link href={hrefFor({ q })} aria-current={!category ? "true" : undefined} className={chipClass(!category)}>Tất cả</Link>
              {data.categories.map((item) => (
                <Link key={item.name} href={hrefFor({ category: item.name, q })} aria-current={category === item.name ? "true" : undefined} className={chipClass(category === item.name)}>
                  {item.name} ({item.count})
                </Link>
              ))}
              {q || category ? <Link href="/kien-thuc" className="inline-flex min-h-9 shrink-0 items-center text-sm font-medium text-[var(--public-primary)] underline underline-offset-4">Xóa lọc</Link> : null}
            </nav>
          ) : null}
        </div>
      </CatalogHeader>

      <section className="ui-container py-6 sm:py-8">
        {!data ? (
          <p className="rounded-lg border border-dashed border-[var(--public-border)] p-6 text-sm text-[var(--public-muted)]">Chưa tải được danh sách bài viết. Bạn thử tải lại trang nhé.</p>
        ) : data.items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((article) => (
              <li key={article.id}>
                <Link href={`/kien-thuc/${article.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] transition hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-lg motion-reduce:transition-none">
                  <span className="flex aspect-[5/2] items-center justify-center overflow-hidden bg-[var(--public-tint-strong)] text-[var(--public-primary-dark)]" aria-hidden="true">
                    {article.coverImage ? <img src={article.coverImage} alt="" width={640} height={256} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <BookOpenText className="h-9 w-9" />}
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-sm font-medium text-[var(--public-primary)]">{article.category || "Kiến thức sức khỏe"}</span>
                    <h2 className="mt-1 text-lg font-semibold leading-snug">{article.title}</h2>
                    {article.summary ? <span className="mt-1.5 line-clamp-2 text-base leading-7 text-[var(--public-text-soft)]">{article.summary}</span> : null}
                    <span className="mt-auto pt-3 text-sm text-[var(--public-muted)]">
                      {[article.reviewerName ? `Duyệt: ${article.reviewerName}` : "", formatDate(article.publishedAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--public-border)] p-6 text-sm text-[var(--public-muted)]">
            {q || category ? "Chưa có bài viết phù hợp. Bạn thử từ khóa hoặc danh mục khác." : "Các bài viết kiến thức sức khỏe sẽ sớm được cập nhật."}
          </p>
        )}

        {data && data.pagination.totalPages > 1 ? (
          <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-3 text-sm">
            {page > 1 ? <Link href={hrefFor({ category, q, page: page - 1 })} aria-label="Trang trước" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] hover:border-[var(--public-primary)]"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Link> : null}
            <span className="text-[var(--public-muted)]">Trang {page}/{data.pagination.totalPages}</span>
            {page < data.pagination.totalPages ? <Link href={hrefFor({ category, q, page: page + 1 })} aria-label="Trang sau" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] hover:border-[var(--public-primary)]"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}

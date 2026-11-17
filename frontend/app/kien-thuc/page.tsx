import Link from "next/link";
import { BookOpenText, Search } from "lucide-react";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
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
      <div className="ui-container py-5 sm:py-8">
        <PublicBreadcrumb current="Kiến thức sức khỏe" />
        <h1 className="text-2xl font-bold sm:text-3xl">Kiến thức sức khỏe</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">
          Bài viết do đội ngũ bác sĩ biên soạn và duyệt. Đây là thông tin tham khảo, không thay thế tư vấn của bác sĩ.
        </p>

        <form action="/kien-thuc" method="get" className="mt-5 flex max-w-xl gap-2" role="search">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <label className="sr-only" htmlFor="article-search">Tìm bài viết</label>
          <input id="article-search" name="q" defaultValue={q} placeholder="Tìm bài viết, ví dụ: ăn uống, giấc ngủ" className="ui-field min-w-0 flex-1 px-3 py-2 text-base sm:text-sm" />
          <button type="submit" className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white">
            <Search className="h-4 w-4" aria-hidden="true" />
            Tìm
          </button>
        </form>

        {data?.categories.length ? (
          <nav aria-label="Danh mục bài viết" className="mt-4 flex flex-wrap gap-2">
            <Link href={hrefFor({ q })} className={`rounded-full border px-3 py-1.5 text-sm ${!category ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] font-semibold text-[var(--public-primary-dark)]" : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}>
              Tất cả
            </Link>
            {data.categories.map((item) => (
              <Link key={item.name} href={hrefFor({ category: item.name, q })} className={`rounded-full border px-3 py-1.5 text-sm ${category === item.name ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] font-semibold text-[var(--public-primary-dark)]" : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}>
                {item.name} ({item.count})
              </Link>
            ))}
          </nav>
        ) : null}

        {!data ? (
          <p className="mt-8 rounded-lg border border-dashed border-[var(--public-border)] p-6 text-sm text-[var(--public-muted)]">Chưa tải được danh sách bài viết. Bạn thử tải lại trang nhé.</p>
        ) : data.items.length ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((article) => (
              <li key={article.id}>
                <Link href={`/kien-thuc/${article.slug}`} className="flex h-full flex-col rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 transition hover:border-[var(--public-primary)]">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--public-primary)]">
                    <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
                    {article.category || "Kiến thức sức khỏe"}
                  </span>
                  <h2 className="mt-2 text-lg font-bold leading-snug">{article.title}</h2>
                  {article.summary ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--public-text-soft)]">{article.summary}</p> : null}
                  <span className="mt-auto pt-3 text-xs text-[var(--public-muted)]">
                    {[article.reviewerName ? `Duyệt: ${article.reviewerName}` : "", formatDate(article.publishedAt)].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-lg border border-dashed border-[var(--public-border)] p-6 text-sm text-[var(--public-muted)]">
            {q || category ? "Chưa có bài viết phù hợp. Bạn thử từ khóa hoặc danh mục khác." : "Các bài viết kiến thức sức khỏe sẽ sớm được cập nhật."}
          </p>
        )}

        {data && data.pagination.totalPages > 1 ? (
          <nav aria-label="Phân trang" className="mt-6 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? <Link href={hrefFor({ category, q, page: page - 1 })} className="rounded-xl border border-[var(--public-border)] bg-white px-4 py-2 font-medium">Trang trước</Link> : <span />}
            <span className="text-[var(--public-muted)]">Trang {page}/{data.pagination.totalPages}</span>
            {page < data.pagination.totalPages ? <Link href={hrefFor({ category, q, page: page + 1 })} className="rounded-xl border border-[var(--public-border)] bg-white px-4 py-2 font-medium">Trang sau</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </main>
  );
}

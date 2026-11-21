import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ArticleContent } from "@/components/public/article-content";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { SummarizeWithKun } from "@/components/public/summarize-with-kun";
import { estimateReadingMinutes, getOutline, parseMarkdown } from "@/lib/markdown";
import { serverApiRequest } from "@/lib/server-api";
import { absoluteUrl, buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, cleanText, jsonLdString, truncateText } from "@/lib/seo";
import type { Article } from "@/lib/types";

type PageProps = { params: Promise<{ slug: string }> };

const getArticle = cache(async (slug: string) => serverApiRequest<Article>(`/articles/${slug}`, { next: { revalidate: 300 } }));

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const article = await getArticle(slug);
    return buildOpenGraph({
      title: article.title,
      description: truncateText(cleanText(article.summary, `Bài viết kiến thức sức khỏe: ${article.title}`)),
      path: `/kien-thuc/${slug}`,
      image: article.coverImage,
    });
  } catch {
    return buildNoIndexMetadata({ title: "Bài viết kiến thức sức khỏe", description: "Bài viết kiến thức sức khỏe do đội ngũ bác sĩ biên soạn và duyệt." });
  }
}

export default async function KnowledgeArticlePage({ params }: PageProps) {
  const { slug } = await params;
  let article: Article;
  try {
    article = await getArticle(slug);
  } catch {
    notFound();
  }

  const blocks = parseMarkdown(article.content);
  const outline = getOutline(blocks);
  const description = cleanText(article.summary, `Bài viết kiến thức sức khỏe: ${article.title}`);
  const bookingHref = article.department ? `/dat-lich?departmentId=${article.department.id}` : "/dat-lich";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: article.title,
    headline: article.title,
    description,
    url: absoluteUrl(`/kien-thuc/${slug}`),
    inLanguage: "vi-VN",
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.updatedAt,
    lastReviewed: article.reviewedAt ?? undefined,
    reviewedBy: article.reviewerName ? { "@type": "Person", name: article.reviewerName } : undefined,
    author: article.authorName ? { "@type": "Person", name: article.authorName } : undefined,
    publisher: { "@id": absoluteUrl("/#organization") },
    about: article.department ? { "@type": "MedicalSpecialty", name: article.department.name } : undefined,
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Kiến thức sức khỏe", path: "/kien-thuc" },
    { name: article.title, path: `/kien-thuc/${slug}` },
  ]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
      <div className="ui-container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 py-5 sm:py-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <article className="min-w-0 max-w-3xl">
          <PublicBreadcrumb current={article.title} />
          <header>
            {article.category ? <p className="text-sm font-semibold text-[var(--public-primary)]">{article.category}</p> : null}
            <h1 className="mt-1 text-2xl font-bold leading-snug sm:text-3xl">{article.title}</h1>
            {article.summary ? <p className="mt-3 text-base leading-7 text-[var(--public-text-soft)]">{article.summary}</p> : null}
            <p className="mt-3 text-xs text-[var(--public-muted)]">
              {[article.authorName ? `Biên soạn: ${article.authorName}` : "", `Cập nhật ${formatDate(article.updatedAt)}`, `${estimateReadingMinutes(article.content)} phút đọc`].filter(Boolean).join(" · ")}
            </p>
          </header>

          {article.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.coverImage} alt="" width={1200} height={675} fetchPriority="high" decoding="async" className="mt-5 aspect-[16/9] w-full rounded-xl object-cover" />
          ) : null}

          <div className="mt-4"><SummarizeWithKun slug={article.slug} /></div>

          {article.reviewerName ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--public-success-soft)] px-3 py-2 text-sm text-[var(--public-success)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Nội dung đã được {article.reviewerName} duyệt{article.reviewedAt ? ` ngày ${formatDate(article.reviewedAt)}` : ""}.
              </span>
            </p>
          ) : null}

          <div className="mt-6">
            <ArticleContent blocks={blocks} />
          </div>

          <p className="mt-8 rounded-lg border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4 text-sm leading-6 text-[var(--public-text-soft)]">
            Đây là thông tin tham khảo, không thay thế tư vấn, chẩn đoán hay điều trị của bác sĩ. Nếu có dấu hiệu nặng hoặc kéo dài, hãy đến cơ sở y tế gần nhất.
          </p>

          <Link href={bookingHref} className="public-button-primary mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white">
            {article.department ? `Đặt lịch khám ${article.department.name}` : "Đặt lịch khám"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </article>

        {outline.length > 1 ? (
          <aside className="lg:sticky lg:top-24">
            <nav aria-label="Mục lục" className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
              <p className="text-sm font-bold">Trong bài viết</p>
              <ol className="mt-3 space-y-2 text-sm">
                {outline.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="text-[var(--public-text-soft)] hover:text-[var(--public-primary)]">{item.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        ) : null}
      </div>
    </main>
  );
}

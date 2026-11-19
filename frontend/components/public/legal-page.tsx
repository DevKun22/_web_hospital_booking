import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleContent } from "@/components/public/article-content";
import { formatViDate } from "@/components/public/catalog-content";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { serverApiRequest } from "@/lib/server-api";
import { buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, jsonLdString } from "@/lib/seo";
import { parseMarkdown } from "@/lib/markdown";
import type { LegalDoc, LegalDocuments } from "@/lib/legal";

// Trang điều khoản và chính sách bảo mật: nội dung do cơ sở khám soạn. Chưa soạn thì trang không tồn tại (404), không hiện văn bản mẫu.

type Key = "terms" | "privacy";

const load = async (key: Key): Promise<LegalDoc | null> => {
  try {
    return (await serverApiRequest<LegalDocuments>("/legal"))[key];
  } catch {
    return null;
  }
};

export const legalMetadata = (key: Key, path: string, fallbackTitle: string) => async (): Promise<Metadata> => {
  const doc = await load(key);
  if (!doc) return buildNoIndexMetadata({ title: fallbackTitle, description: "Nội dung đang được cập nhật." });
  return buildOpenGraph({ title: doc.title, description: `${doc.title} của cơ sở khám.`, path });
};

export const legalPage = (key: Key, path: string, fallbackTitle: string) =>
  async function LegalPage() {
    const doc = await load(key);
    if (!doc) notFound();
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Trang chủ", path: "/" },
      { name: doc.title || fallbackTitle, path },
    ]);
    return (
      <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
        <section className="ui-container py-5 sm:py-8">
          <PublicBreadcrumb current={doc.title} />
          <article className="max-w-3xl">
            <h1 className="text-2xl font-bold sm:text-3xl">{doc.title}</h1>
            <p className="mt-2 text-sm text-[var(--public-muted)]">
              Cập nhật ngày <time dateTime={doc.updatedAt}>{formatViDate(doc.updatedAt)}</time>
            </p>
            <div className="mt-6">
              <ArticleContent blocks={parseMarkdown(doc.body)} />
            </div>
          </article>
        </section>
      </main>
    );
  };

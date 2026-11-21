import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleContent } from "@/components/public/article-content";
import { ArticleOutline } from "@/components/public/article-outline";
import { formatViDate } from "@/components/public/catalog-content";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { serverApiRequest } from "@/lib/server-api";
import { buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, jsonLdString } from "@/lib/seo";
import { getOutline, parseMarkdown } from "@/lib/markdown";
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
    const blocks = parseMarkdown(doc.body);
    const outline = getOutline(blocks);
    const other = key === "terms" ? { href: "/chinh-sach-bao-mat", label: "Chính sách bảo mật" } : { href: "/dieu-khoan", label: "Điều khoản sử dụng" };
    return (
      <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
        <section className="ui-container py-5 sm:py-8">
          <PublicBreadcrumb current={doc.title} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,48rem)_16rem] lg:items-start">
          <article>
            <h1 className="text-2xl font-bold sm:text-3xl">{doc.title}</h1>
            <p className="mt-2 text-sm text-[var(--public-muted)]">
              Cập nhật ngày <time dateTime={doc.updatedAt}>{formatViDate(doc.updatedAt)}</time>
            </p>
            <div className="mt-6">
              <ArticleContent blocks={blocks} />
            </div>
          </article>
          <aside className="space-y-3 lg:sticky lg:top-24">
            {outline.length > 1 ? <ArticleOutline items={outline} title="Nội dung" /> : null}
            <p className="text-sm text-[var(--public-muted)]">
              Xem thêm: <Link href={other.href} className="font-semibold text-[var(--public-primary)] underline underline-offset-4">{other.label}</Link>
            </p>
          </aside>
          </div>
        </section>
      </main>
    );
  };

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleContent } from "@/components/public/article-content";
import { ArticleOutline } from "@/components/public/article-outline";
import { formatViDate } from "@/components/public/catalog-content";
import { CatalogHeader, ChatbotHint } from "@/components/public/catalog-parts";
import { PrintPageButton } from "@/components/public/print-page-button";
import { ReadingProgress } from "@/components/public/reading-progress";
import { serverApiRequest } from "@/lib/server-api";
import { buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, jsonLdString } from "@/lib/seo";
import { getOutline, parseMarkdown } from "@/lib/markdown";
import type { LegalDoc, LegalDocuments } from "@/lib/legal";
import type { SiteSettingsValue } from "@/lib/types";

// Trang điều khoản và chính sách bảo mật: nội dung do cơ sở khám soạn. Chưa soạn thì trang không tồn tại (404), không hiện văn bản mẫu.

type Key = "terms" | "privacy";

const load = async (key: Key): Promise<LegalDoc | null> => {
  try {
    return (await serverApiRequest<LegalDocuments>("/legal"))[key];
  } catch {
    return null;
  }
};

// Email của cơ sở để người đọc hỏi về dữ liệu cá nhân; chưa cấu hình thì không hiện (không dùng địa chỉ mẫu).
const loadContactEmail = async () => {
  try {
    return (await serverApiRequest<SiteSettingsValue>("/site-settings", { next: { revalidate: 60 } })).email?.trim() || "";
  } catch {
    return "";
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
    const email = await loadContactEmail();
    return (
      <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
        <CatalogHeader brand current={doc.title} title={doc.title}>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
            <span>Cập nhật ngày <time dateTime={doc.updatedAt}>{formatViDate(doc.updatedAt)}</time></span>
            <span>Xem thêm: <Link href={other.href} className="font-semibold text-white underline underline-offset-4">{other.label}</Link></span>
          </p>
        </CatalogHeader>
        <ReadingProgress targetId="van-ban" />

        <section className="ui-container py-6 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,48rem)_16rem] lg:items-start">
            <article id="van-ban" className="min-w-0 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5 sm:p-8">
              <div className="[&>div>h2:first-child]:mt-0 [&>div>h2:first-child]:border-t-0 [&>div>h2:first-child]:pt-0">
                <ArticleContent blocks={blocks} />
              </div>
            </article>
            <aside className="space-y-3 lg:sticky lg:top-28">
              {outline.length > 1 ? <ArticleOutline items={outline} title="Nội dung" /> : null}
              <PrintPageButton />
            </aside>
          </div>

          <ul className="mt-8 grid max-w-[64rem] gap-3 sm:grid-cols-2">
            <li>
              <Link href={other.href} className="block h-full rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 transition hover:border-[var(--public-primary)]">
                <span className="block text-base font-semibold">{other.label}</span>
                <span className="mt-1 block text-sm text-[var(--public-muted)]">{key === "terms" ? "Cách chúng tôi thu thập, dùng và bảo vệ dữ liệu của bạn." : "Điều kiện đặt lịch và sử dụng dịch vụ."}</span>
              </Link>
            </li>
            <li className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
              <span className="block text-base font-semibold">Câu hỏi về dữ liệu cá nhân?</span>
              <span className="mt-1 block text-sm text-[var(--public-muted)]">
                {email ? (
                  <>Gửi email tới <a href={`mailto:${email}`} className="font-semibold text-[var(--public-primary)] underline underline-offset-4">{email}</a> hoặc hỏi trợ lý.</>
                ) : (
                  "Hỏi trợ lý hoặc xem trang Hỗ trợ để biết cách liên hệ với cơ sở khám."
                )}
              </span>
            </li>
          </ul>
          <ChatbotHint>Cần giải thích một mục trong văn bản này?</ChatbotHint>
        </section>
      </main>
    );
  };

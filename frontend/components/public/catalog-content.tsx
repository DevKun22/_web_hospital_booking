import { ArticleContent } from "@/components/public/article-content";
import { parseMarkdown } from "@/lib/markdown";
import { sectionAnchors } from "@/lib/section-anchors";
import type { ContentSection } from "@/lib/types";

// Khối nội dung giới thiệu dùng chung cho trang chuyên khoa, bác sĩ, gói khám. Mọi mục để trống đều không hiển thị (không có khung rỗng).

export const formatViDate = (value: string) => new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

// Dòng uy tín: ngày cập nhật nội dung và người duyệt chuyên môn; không có thông tin thì không hiện gì.
export function TrustLine({ updatedAt, reviewerName, subject = "Nội dung" }: { updatedAt?: string | null; reviewerName?: string | null; subject?: string }) {
  if (!updatedAt && !reviewerName) return null;
  return (
    <p className="mt-2 text-sm text-[var(--public-muted)]">
      {updatedAt ? (
        <>
          {subject} cập nhật ngày <time dateTime={updatedAt}>{formatViDate(updatedAt)}</time>
        </>
      ) : null}
      {updatedAt && reviewerName ? " · " : null}
      {reviewerName ? `Duyệt chuyên môn: ${reviewerName}` : null}
    </p>
  );
}

export function AnchorNav({ items }: { items: { id: string; label: string }[] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Nội dung trang" className="mt-6 flex flex-wrap gap-2">
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className="rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]">
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function IntroSections({ sections }: { sections: ContentSection[] | undefined }) {
  const anchors = sectionAnchors(sections);
  return (
    <>
      {anchors.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mt-8 scroll-mt-24 border-t border-[var(--public-divider)] pt-6">
          <h2 id={`${section.id}-title`} className="text-lg font-bold">{section.title}</h2>
          <div className="mt-3 max-w-3xl">
            <ArticleContent blocks={parseMarkdown(section.body)} />
          </div>
        </section>
      ))}
    </>
  );
}

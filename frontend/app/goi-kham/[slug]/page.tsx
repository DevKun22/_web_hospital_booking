import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { CatalogHeader } from "@/components/public/catalog-parts";
import { BookingSteps } from "@/components/public/booking-steps";
import { StickyAnchorNav } from "@/components/public/sticky-anchor-nav";
import { AskKunButton } from "@/components/public/ask-kun-button";
import { PackageCard } from "@/features/packages/components/package-card";
import type { PublicPackageCatalogResponse } from "@/components/public/public-home-types";
import { serverApiRequest } from "@/lib/server-api";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildNoIndexMetadata,
  buildOpenGraph,
  cleanText,
  jsonLdString,
  truncateText,
} from "@/lib/seo";
import type { MedicalPackage } from "@/lib/types";

import { formatCurrency } from "@/lib/format";
type PageProps = {
  params: Promise<{ slug: string }>;
};


const getBookingUrl = (item: MedicalPackage) => {
  const params = new URLSearchParams({ packageId: item.id });
  if (item.department?.id) params.set("departmentId", item.department.id);
  return `/dat-lich?${params.toString()}`;
};

const getPackage = cache(async (slug: string) =>
  serverApiRequest<MedicalPackage>(`/packages/${slug}`),
);

async function getRelatedPackages(item: MedicalPackage) {
  if (!item.department?.id) return [];

  try {
    const query = new URLSearchParams({
      departmentId: item.department.id,
      limit: "3",
      sort: "POPULAR_DESC",
    });
    const result = await serverApiRequest<PublicPackageCatalogResponse>(`/packages/catalog?${query.toString()}`);
    return result.items.filter((candidate) => candidate.id !== item.id).slice(0, 2);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await getPackage(slug);
    return buildOpenGraph({
      title: `${item.name} - Gói khám`,
      description: truncateText(cleanText(item.summary || item.description, `Chi tiết gói khám ${item.name}, chi phí dự kiến và hạng mục bao gồm.`)),
      path: `/goi-kham/${slug}`,
    });
  } catch {
    return buildNoIndexMetadata({
      title: "Chi tiết gói khám",
      description: "Thông tin gói khám, chi phí, hạng mục và đặt lịch khám trực tuyến.",
    });
  }
}

export default async function PublicPackageDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let packageItem: MedicalPackage;

  try {
    packageItem = await getPackage(slug);
  } catch {
    notFound();
  }

  const relatedPackages = await getRelatedPackages(packageItem);
  const bookingUrl = getBookingUrl(packageItem);
  const description = cleanText(
    packageItem.summary || packageItem.description,
    "Gói khám được thiết kế để người khám xem trước hạng mục và chi phí dự kiến trước khi đặt lịch.",
  );
  const includedItems = packageItem.items.filter((item) => item.included);
  const additionalItems = packageItem.items.filter((item) => !item.included);
  // Ô số liệu thật dưới dải xanh; ô nào không có dữ liệu thì không hiện.
  const facts = [
    includedItems.length ? { label: "Hạng mục đã gồm", value: String(includedItems.length) } : null,
    packageItem.resultTime ? { label: "Có kết quả", value: packageItem.resultTime } : null,
    packageItem.audience?.length ? { label: "Nên làm", value: packageItem.audience[0] } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: packageItem.name,
    description,
    url: absoluteUrl(`/goi-kham/${slug}`),
    about: packageItem.department ? { "@type": "MedicalSpecialty", name: packageItem.department.name } : undefined,
    mainEntity: {
      "@type": "Service",
      name: packageItem.name,
      description,
      provider: { "@id": absoluteUrl("/#organization") },
      offers: {
        "@type": "Offer",
        price: packageItem.finalPrice,
        priceCurrency: "VND",
        availability: "https://schema.org/InStock",
      },
    },
  };
  const faqJsonLd = packageItem.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: packageItem.faq.map((entry) => ({ "@type": "Question", name: entry.question, acceptedAnswer: { "@type": "Answer", text: entry.answer } })),
      }
    : null;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Gói khám", path: "/goi-kham" },
    { name: packageItem.name, path: `/goi-kham/${slug}` },
  ]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
      {faqJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }} /> : null}

      <CatalogHeader
        brand
        overlap
        current={packageItem.name}
        title={packageItem.name}
        description={description}
        trail={[{ label: "Gói khám", href: "/goi-kham" }]}
      >
        <div className="flex flex-wrap gap-2 text-sm font-medium">
          <span className="rounded-full border border-white/50 px-3 py-1">{packageItem.department?.name || "Đa chuyên khoa"}</span>
          {packageItem.isBHYTSupport ? <span className="rounded-full border border-white/50 px-3 py-1">Hỗ trợ BHYT</span> : null}
          {packageItem.isPopular ? <span className="rounded-full border border-white/50 px-3 py-1">Nổi bật</span> : null}
          {packageItem.resultTime ? <span className="rounded-full border border-white/50 px-3 py-1">Có kết quả: {packageItem.resultTime}</span> : null}
        </div>
      </CatalogHeader>

      <div className="ui-container relative z-10 grid grid-cols-[minmax(0,1fr)] min-w-0 gap-6 pb-8 pt-5 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 lg:pt-0">
        <div className="min-w-0 lg:-mt-20">
          {facts.length ? (
            <ul className="flex flex-wrap gap-3">
              {facts.map((fact) => (
                <li key={fact.label} className="min-w-[9rem] flex-1 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 shadow-sm">
                  <p className="text-sm text-[var(--public-muted)]">{fact.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-base font-semibold text-[var(--public-ink)]">{fact.value}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <StickyAnchorNav items={[...(packageItem.audience?.length ? [{ id: "doi-tuong", label: "Đối tượng nên làm" }] : []), { id: "hang-muc", label: "Hạng mục" }, ...(packageItem.faq?.length ? [{ id: "hoi-dap", label: "Hỏi đáp" }] : []), { id: "quy-trinh", label: "Cách đặt lịch" }]} />
          {packageItem.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={packageItem.image} alt={packageItem.name} width={960} height={540} fetchPriority="high" decoding="async" className="mt-5 aspect-[16/9] w-full max-w-2xl rounded-xl border border-[var(--public-border)] object-cover" />
          ) : null}

          {packageItem.audience?.length ? (
            <section id="doi-tuong" aria-labelledby="doi-tuong-title" className="mt-8 scroll-mt-24 border-t border-[var(--public-divider)] pt-6">
              <h2 id="doi-tuong-title" className="text-xl font-bold">Đối tượng nên làm</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-base text-[var(--public-text-soft)]">
                {packageItem.audience.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="hang-muc" aria-labelledby="hang-muc-title" className="mt-8 border-t border-[var(--public-divider)] pt-6">
            <h2 id="hang-muc-title" className="text-xl font-bold">Hạng mục trong gói</h2>
            {includedItems.length ? (
              <ul className="mt-3 divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
                {includedItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--public-success-soft)] text-[var(--public-success)]" aria-hidden="true"><Check className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{item.name}</p>
                      {item.description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--public-border)] p-5 text-sm text-[var(--public-muted)]">Hạng mục chi tiết đang được cập nhật.</p>
            )}

            {additionalItems.length ? (
              <div className="mt-6">
                <h3 className="text-base font-bold">Hạng mục tính riêng nếu chọn thêm</h3>
                <ul className="mt-3 divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
                  {additionalItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="text-base font-semibold">{item.name}</p>
                        {item.description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p> : null}
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {packageItem.note ? (
            <section className="mt-8 border-t border-[var(--public-divider)] pt-6">
              <h2 className="text-xl font-bold">Lưu ý từ gói khám</h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">{packageItem.note}</p>
            </section>
          ) : null}

          {packageItem.faq?.length ? (
            <section id="hoi-dap" aria-labelledby="hoi-dap-title" className="mt-8 scroll-mt-24 border-t border-[var(--public-divider)] pt-6">
              <h2 id="hoi-dap-title" className="text-xl font-bold">Hỏi đáp về gói</h2>
              <div className="mt-3 divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
                {packageItem.faq.map((entry, index) => (
                  <details key={index} className="group p-4">
                    <summary className="cursor-pointer text-base font-semibold">{entry.question}</summary>
                    <p className="mt-2 text-base leading-7 text-[var(--public-text-soft)]">{entry.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <section id="quy-trinh" aria-labelledby="quy-trinh-title" className="mt-8 border-t border-[var(--public-divider)] pt-6">
            <h2 id="quy-trinh-title" className="text-xl font-bold">Đặt lịch trong 5 bước</h2>
            <BookingSteps />
          </section>

          {relatedPackages.length ? (
            <section className="mt-8 border-t border-[var(--public-divider)] pt-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-bold">Gói khám liên quan</h2>
                <Link href={`/goi-kham?chuyen-khoa=${packageItem.department?.id || ""}`} className="text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem tất cả</Link>
              </div>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {relatedPackages.map((item) => <li key={item.id}><PackageCard item={item} /></li>)}
              </ul>
            </section>
          ) : null}
        </div>

        <aside aria-label="Chi phí và đặt lịch" className="hidden h-fit min-w-0 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-5 shadow-lg lg:sticky lg:top-28 lg:-mt-28 lg:block">
          <p className="text-sm text-[var(--public-muted)]">Chi phí dự kiến</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(packageItem.finalPrice)}</p>
          <dl className="mt-4 space-y-2 border-y border-[var(--public-divider)] py-4 text-sm">
            <SummaryRow label="Hạng mục bao gồm" value={String(includedItems.length)} />
            <SummaryRow label="Tổng hạng mục" value={formatCurrency(packageItem.basePrice)} />
            <SummaryRow label="Phí dịch vụ" value={formatCurrency(packageItem.serviceFee)} />
            <SummaryRow label="BHYT" value={packageItem.isBHYTSupport ? "Có hỗ trợ" : "Không ghi nhận"} />
          </dl>
          <p className="mt-3 text-sm leading-5 text-[var(--public-muted)]">Chi phí cuối cùng có thể thay đổi khi chọn thêm hạng mục hoặc theo chính sách tại thời điểm tiếp nhận.</p>
          <Link href={bookingUrl} className="public-button-primary mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold">Chọn lịch với gói này<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          {packageItem.department?.slug ? <Link href={`/chuyen-khoa/${packageItem.department.slug}`} className="public-button-secondary mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold">Xem chuyên khoa</Link> : null}
          <div className="mt-2"><AskKunButton label="Hỏi Kun về gói này" /></div>
        </aside>
      </div>

      {/* Điện thoại: chi phí và nút chọn gói cố định dưới màn hình, dùng chung kiểu với trang đặt lịch. */}
      <div className="lg:hidden">
        <div className="booking-action-bar">
          <div className="booking-action-bar__inner">
            <p className="min-w-0 shrink-0 text-sm text-[var(--public-muted)]">Chi phí dự kiến<span className="block text-lg font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(packageItem.finalPrice)}</span></p>
            <Link href={bookingUrl} className="public-button-primary inline-flex min-h-12 flex-1 items-center justify-center rounded-lg px-4 text-base font-semibold">Chọn gói này</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-[var(--public-muted)]">{label}</dt><dd className="text-right font-semibold text-[var(--public-ink)]">{value}</dd></div>;
}

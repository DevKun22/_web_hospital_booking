import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { AnchorNav } from "@/components/public/catalog-content";
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

      <div className="ui-container grid grid-cols-[minmax(0,1fr)] min-w-0 gap-6 py-5 sm:py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <PublicBreadcrumb current={packageItem.name} />
          <header>
            <h1 className="text-2xl font-bold sm:text-3xl">{packageItem.name}</h1>
            <p className="mt-1 text-sm text-[var(--public-muted)]">
              {[packageItem.department?.name || "Đa chuyên khoa", packageItem.isBHYTSupport ? "Hỗ trợ BHYT" : "", packageItem.isPopular ? "Nổi bật" : ""].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">{description}</p>
            {packageItem.resultTime ? <p className="mt-3 text-sm text-[var(--public-muted)]">Thời gian có kết quả: <strong className="font-semibold text-[var(--public-ink)]">{packageItem.resultTime}</strong></p> : null}
          </header>
          <AnchorNav items={[...(packageItem.audience?.length ? [{ id: "doi-tuong", label: "Đối tượng nên làm" }] : []), { id: "hang-muc", label: "Hạng mục" }, ...(packageItem.faq?.length ? [{ id: "hoi-dap", label: "Hỏi đáp" }] : []), { id: "quy-trinh", label: "Cách đặt lịch" }]} />
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
                  <li key={item.id} className="p-4">
                    <p className="text-base font-semibold">{item.name}</p>
                    {item.description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p> : null}
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
            <h2 id="quy-trinh-title" className="text-xl font-bold">Đặt lịch gồm 4 bước</h2>
            <ol className="mt-3 space-y-2 text-base text-[var(--public-text-soft)]">
              <li><strong className="text-[var(--public-ink)]">1. Chọn gói.</strong> Gói này đã được chuyển sẵn sang trang đặt lịch.</li>
              <li><strong className="text-[var(--public-ink)]">2. Chọn lịch.</strong> Chọn bác sĩ, ngày và khung giờ còn trống.</li>
              <li><strong className="text-[var(--public-ink)]">3. Nhập thông tin.</strong> Bổ sung thông tin người khám và BHYT nếu có.</li>
              <li><strong className="text-[var(--public-ink)]">4. Xác thực OTP.</strong> Nhập mã gửi về để hoàn tất yêu cầu.</li>
            </ol>
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

        <aside aria-label="Chi phí và đặt lịch" className="hidden h-fit min-w-0 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-5 lg:sticky lg:top-28 lg:block">
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

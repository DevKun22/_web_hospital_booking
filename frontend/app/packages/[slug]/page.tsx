import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight, PackageCheck, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { serverApiRequest } from "@/lib/server-api";
import { absoluteUrl, buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, cleanText, jsonLdString, truncateText } from "@/lib/seo";
import type { MedicalPackage } from "@/lib/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const getBookingUrl = (item: MedicalPackage) => {
  const params = new URLSearchParams();

  if (item.department?.id) params.set("departmentId", item.department.id);
  params.set("packageId", item.id);

  return `/?${params.toString()}#booking`;
};

const getPackage = cache(async (slug: string) => {
  return serverApiRequest<MedicalPackage>(`/packages/${slug}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const item = await getPackage(slug);
    const description = truncateText(
      cleanText(
        item.summary || item.description,
        `Chi tiết gói khám ${item.name}, giá tạm tính, hạng mục bao gồm và đặt lịch khám trực tuyến.`,
      ),
    );

    return buildOpenGraph({
      title: `${item.name} - Gói khám`,
      description,
      path: `/packages/${slug}`,
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

  const bookingUrl = getBookingUrl(packageItem);
  const description = cleanText(
    packageItem.summary || packageItem.description,
    "Gói khám được thiết kế để giúp người bệnh chuẩn bị thông tin rõ ràng trước khi đặt lịch.",
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: packageItem.name,
    description,
    url: absoluteUrl(`/packages/${slug}`),
    about: packageItem.department
      ? {
          "@type": "MedicalSpecialty",
          name: packageItem.department.name,
        }
      : undefined,
    mainEntity: {
      "@type": "Service",
      name: packageItem.name,
      description,
      provider: {
        "@id": absoluteUrl("/#organization"),
      },
      offers: {
        "@type": "Offer",
        price: packageItem.finalPrice,
        priceCurrency: "VND",
        availability: packageItem.isActive ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    },
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Gói khám", path: "/packages" },
    { name: packageItem.name, path: `/packages/${slug}` },
  ]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f1faf7_0%,var(--public-canvas)_46%,#ffffff_100%)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />

      <section className="ui-container py-8 sm:py-10">
        <PublicBreadcrumb current={packageItem.name} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-6">
            <div className="flex flex-wrap gap-2">
              {packageItem.isPopular ? <span className="inline-flex items-center gap-1 rounded-md bg-[#fff4d6] px-2 py-1 text-xs font-semibold text-[#8a5a00]"><Star className="h-3.5 w-3.5" />Phổ biến</span> : null}
              {packageItem.isBHYTSupport ? <span className="inline-flex items-center gap-1 rounded-md bg-[#e7f6ed] px-2 py-1 text-xs font-semibold text-[#1f7a3a]"><ShieldCheck className="h-3.5 w-3.5" />Hỗ trợ BHYT</span> : null}
              {packageItem.department ? <span className="rounded-md bg-[var(--public-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--public-text-soft)]">{packageItem.department.name}</span> : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{packageItem.name}</h1>
            <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">{description}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <PriceBox label="Tổng hạng mục" value={packageItem.basePrice} />
              <PriceBox label="Phí dịch vụ" value={packageItem.serviceFee} />
              <PriceBox label="Thành tiền" value={packageItem.finalPrice} highlight />
            </div>

            <section className="mt-8">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <PackageCheck className="h-5 w-5 text-[var(--public-primary)]" />
                Hạng mục trong gói
              </div>
              <div className="mt-4 space-y-3">
                {packageItem.items.length ? packageItem.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--public-divider)] bg-[var(--public-surface-muted)] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        {item.description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
                        <span className="whitespace-nowrap text-sm font-semibold text-[#172033]">{formatCurrency(item.price)}</span>
                        <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${item.included ? "bg-[#e7f6ed] text-[#1f7a3a]" : "bg-[#fff4d6] text-[#8a5a00]"}`}>
                          {item.included ? "Đã bao gồm" : "Tính riêng"}
                        </span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-[#dce3ee] p-5 text-sm text-[#667892]">
                    Chưa có hạng mục chi tiết cho gói khám này.
                  </div>
                )}
              </div>
            </section>

            {packageItem.note ? (
              <section className="mt-8 rounded-2xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] p-4">
                <p className="font-semibold text-[var(--public-primary-dark)]">Lưu ý</p>
                <p className="mt-2 text-sm leading-6 text-[var(--public-text-soft)]">{packageItem.note}</p>
              </section>
            ) : null}
          </article>

          <aside className="h-fit rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] lg:sticky lg:top-28">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--public-muted)]">Tóm tắt</p>
            <p className="mt-3 text-3xl font-bold text-[var(--public-primary-dark)]">{formatCurrency(packageItem.finalPrice)}</p>
            <div className="mt-4 space-y-2 text-sm text-[var(--public-muted)]">
              <p>Chuyên khoa: <span className="font-semibold text-[#172033]">{packageItem.department?.name || "Đa chuyên khoa"}</span></p>
              <p>Hạng mục: <span className="font-semibold text-[#172033]">{packageItem.items.length}</span></p>
              <p>BHYT: <span className="font-semibold text-[#172033]">{packageItem.isBHYTSupport ? "Có hỗ trợ" : "Không áp dụng"}</span></p>
            </div>
            <Link href={bookingUrl} className="public-button-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold">
              Chọn gói và đặt lịch
              <ArrowRight className="h-4 w-4" />
            </Link>
            {packageItem.department?.slug ? (
              <Link href={`/departments/${packageItem.department.slug}`} className="public-button-secondary mt-2 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold">
                Xem chuyên khoa
              </Link>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function PriceBox({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)]" : "border-[var(--public-divider)] bg-[var(--public-surface-muted)]"}`}>
      <p className="text-sm text-[var(--public-muted)]">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${highlight ? "text-[var(--public-primary-dark)]" : "text-[var(--public-ink)]"}`}>{formatCurrency(value)}</p>
    </div>
  );
}

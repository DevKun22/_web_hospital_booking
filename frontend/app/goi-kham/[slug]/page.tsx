import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  FileCheck2,
  PackageCheck,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
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
      limit: "4",
      sort: "POPULAR_DESC",
    });
    const result = await serverApiRequest<PublicPackageCatalogResponse>(`/packages/catalog?${query.toString()}`);
    return result.items.filter((candidate) => candidate.id !== item.id).slice(0, 3);
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
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Gói khám", path: "/goi-kham" },
    { name: packageItem.name, path: `/goi-kham/${slug}` },
  ]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />

      <section className="border-b border-[var(--public-border)] bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_60%,#edf9f5_100%)]">
        <div className="ui-container py-5 sm:py-7 lg:py-9">
          <PublicBreadcrumb current={packageItem.name} />
          <div className="grid gap-6 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                {packageItem.isPopular ? <span className="ui-status-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"><Star className="h-3.5 w-3.5" aria-hidden="true" />Gói nổi bật</span> : null}
                {packageItem.isBHYTSupport ? <span className="ui-status-positive inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Hỗ trợ BHYT</span> : null}
                {packageItem.department ? <span className="rounded-full bg-[var(--public-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--public-primary-dark)]">{packageItem.department.name}</span> : null}
              </div>
              <h1 className="mt-4 max-w-4xl text-[1.65rem] font-bold leading-tight tracking-[-0.03em] sm:text-4xl">{packageItem.name}</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--public-muted)] sm:text-base sm:leading-7">{description}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={bookingUrl} className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">Chọn gói và đặt lịch<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <a href="#hang-muc" className="public-button-secondary inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold">Xem hạng mục</a>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Metric label="Hạng mục bao gồm" value={String(includedItems.length)} />
              <Metric label="Phí dịch vụ" value={formatCurrency(packageItem.serviceFee)} />
              <Metric label="Chuyên khoa" value={packageItem.department?.name || "Đa chuyên khoa"} />
              <Metric label="Hỗ trợ BHYT" value={packageItem.isBHYTSupport ? "Có ghi nhận" : "Không ghi nhận"} positive={packageItem.isBHYTSupport} />
            </dl>
          </div>
        </div>
      </section>

      <div className="ui-container grid min-w-0 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:py-10">
        <div className="min-w-0 space-y-6">
          <nav aria-label="Nội dung gói khám" className="flex min-w-0 max-w-full gap-2 overflow-x-auto rounded-xl border border-[var(--public-border)] bg-white p-2 shadow-[var(--public-shadow-soft)]">
            <a href="#hang-muc" className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--public-primary)] px-4 py-2.5 text-sm font-semibold text-white">Hạng mục</a>
            <a href="#chi-phi" className="min-h-10 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]">Chi phí</a>
            <a href="#quy-trinh" className="min-h-10 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]">Quy trình đặt lịch</a>
          </nav>

          <section id="hang-muc" className="scroll-mt-28 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-6">
            <div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" /><h2 className="text-xl font-bold">Danh mục chi tiết trong gói</h2></div>
            <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">Các hạng mục dưới đây được lấy trực tiếp từ cấu hình gói khám hiện tại.</p>
            <div className="mt-5 space-y-3">
              {includedItems.map((item, index) => (
                <article key={item.id} className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4">
                  <div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-xs font-bold text-[var(--public-primary-dark)]">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><h3 className="font-semibold leading-6">{item.name}</h3><span className="shrink-0 text-xs font-semibold text-[#087a55]">Đã bao gồm</span></div>{item.description ? <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p> : null}</div></div>
                </article>
              ))}
              {!includedItems.length ? <div className="rounded-xl border border-dashed border-[var(--public-border)] p-5 text-sm text-[var(--public-muted)]">Hạng mục chi tiết đang được cập nhật.</div> : null}
            </div>

            {additionalItems.length ? <div className="mt-6"><h3 className="font-bold">Hạng mục tính riêng nếu lựa chọn thêm</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{additionalItems.map((item) => <article key={item.id} className="rounded-xl border border-[var(--public-border)] p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold leading-6">{item.name}</p><span className="shrink-0 text-sm font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.price)}</span></div>{item.description ? <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p> : null}</article>)}</div></div> : null}
          </section>

          <section id="chi-phi" className="scroll-mt-28 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-6">
            <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" /><h2 className="text-xl font-bold">Chi phí dự kiến</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PriceBox label="Tổng hạng mục bao gồm" value={packageItem.basePrice} />
              <PriceBox label="Phí dịch vụ" value={packageItem.serviceFee} />
              <PriceBox label="Tổng dự kiến" value={packageItem.finalPrice} highlight />
            </div>
            {packageItem.note ? <div className="mt-4 rounded-xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] p-4"><p className="font-semibold text-[var(--public-primary-dark)]">Lưu ý từ gói khám</p><p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{packageItem.note}</p></div> : null}
          </section>

          <section id="quy-trinh" className="scroll-mt-28 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-6">
            <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" /><h2 className="text-xl font-bold">Đặt lịch theo 4 bước</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ProcessStep number="01" icon={PackageCheck} title="Chọn gói" description="Gói này được chuyển sẵn sang trang đặt lịch." />
              <ProcessStep number="02" icon={CalendarCheck} title="Chọn lịch" description="Chọn bác sĩ, ngày và khung giờ còn tiếp nhận." />
              <ProcessStep number="03" icon={FileCheck2} title="Nhập thông tin" description="Bổ sung thông tin người khám và BHYT nếu có." />
              <ProcessStep number="04" icon={ShieldCheck} title="Xác thực OTP" description="Xác thực mã để hoàn tất yêu cầu đặt lịch." />
            </div>
          </section>

          {relatedPackages.length ? <section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">Cùng chuyên khoa</p><h2 className="mt-2 text-2xl font-bold">Gói khám liên quan</h2></div><Link href={`/goi-kham?chuyen-khoa=${packageItem.department?.id || ""}`} className="text-sm font-semibold text-[var(--public-primary)]">Xem tất cả</Link></div><div className="mt-4 grid gap-4 md:grid-cols-3">{relatedPackages.map((item) => <RelatedPackageCard key={item.id} item={item} />)}</div></section> : null}
        </div>

        <aside className="h-fit min-w-0 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] lg:sticky lg:top-28">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--public-muted)]">Chi phí dự kiến</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(packageItem.finalPrice)}</p>
          <div className="mt-4 space-y-3 border-y border-[var(--public-border)] py-4 text-sm">
            <SummaryRow label="Hạng mục bao gồm" value={String(includedItems.length)} />
            <SummaryRow label="Phí dịch vụ" value={formatCurrency(packageItem.serviceFee)} />
            <SummaryRow label="Chuyên khoa" value={packageItem.department?.name || "Đa chuyên khoa"} />
            <SummaryRow label="BHYT" value={packageItem.isBHYTSupport ? "Có hỗ trợ" : "Không ghi nhận"} />
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--public-muted)]">Chi phí cuối cùng có thể thay đổi khi người khám lựa chọn thêm hạng mục hoặc được áp dụng chính sách tại thời điểm tiếp nhận.</p>
          <Link href={bookingUrl} className="public-button-primary mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">Chọn lịch với gói này<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          {packageItem.department?.slug ? <Link href={`/chuyen-khoa/${packageItem.department.slug}`} className="public-button-secondary mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold">Xem chuyên khoa</Link> : null}
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <div className={`rounded-xl border border-[var(--public-border)] bg-white p-4 ${positive ? "border-t-2 border-t-[#17a673]" : "border-t-2 border-t-[var(--public-primary)]"}`}><dt className="text-xs leading-5 text-[var(--public-muted)]">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-[var(--public-ink)] sm:text-base">{value}</dd></div>;
}

function PriceBox({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return <div className={`rounded-xl border p-4 ${highlight ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)]" : "border-[var(--public-border)] bg-[var(--public-surface-muted)]"}`}><p className="text-xs leading-5 text-[var(--public-muted)]">{label}</p><p className={`mt-2 text-lg font-bold tabular-nums ${highlight ? "text-[var(--public-primary-dark)]" : "text-[var(--public-ink)]"}`}>{formatCurrency(value)}</p></div>;
}

function ProcessStep({ number, icon: Icon, title, description }: { number: string; icon: typeof PackageCheck; title: string; description: string }) {
  return <article className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-[var(--public-primary)]">{number}</span><Icon className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" /></div><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">{description}</p></article>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-[var(--public-muted)]">{label}</span><strong className="text-right text-[var(--public-ink)]">{value}</strong></div>;
}

function RelatedPackageCard({ item }: { item: MedicalPackage }) {
  return <article className="public-card flex flex-col p-4"><p className="text-xs font-semibold text-[var(--public-primary)]">{item.department?.name || "Đa chuyên khoa"}</p><h3 className="mt-2 line-clamp-2 font-bold leading-6">{item.name}</h3><p className="mt-3 text-xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</p><div className="mt-4 grid grid-cols-2 gap-2"><Link href={`/goi-kham/${item.slug}`} className="public-button-secondary inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-xs font-semibold">Chi tiết</Link><Link href={getBookingUrl(item)} className="public-button-primary inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-xs font-semibold">Chọn gói</Link></div></article>;
}

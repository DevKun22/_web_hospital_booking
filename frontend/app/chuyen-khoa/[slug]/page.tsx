/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AskKunButton } from "@/components/public/ask-kun-button";
import { AnchorNav, IntroSections, TrustLine } from "@/components/public/catalog-content";
import { sectionAnchors } from "@/lib/section-anchors";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import type {
  PublicDepartment,
  PublicDepartmentOverview,
} from "@/components/public/public-home-types";
import { getPublicDoctorPath } from "@/lib/public-routes";
import { serverApiRequest } from "@/lib/server-api";
import { buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, cleanText, jsonLdString, truncateText, absoluteUrl } from "@/lib/seo";
import type { DoctorProfile, MedicalPackage } from "@/lib/types";

import { formatCurrency } from "@/lib/format";
import { doctorDisplayName } from "@/lib/doctor";
type PageProps = {
  params: Promise<{ slug: string }>;
};


const firstLetter = (value: string) => value.trim().slice(0, 1).toUpperCase() || "B";

const getDepartment = cache(async (slug: string) => {
  return serverApiRequest<PublicDepartment>(`/departments/${slug}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const department = await getDepartment(slug);
    const description = truncateText(
      cleanText(
        department.description,
        `Thông tin chuyên khoa ${department.name}, bác sĩ, gói khám và đặt lịch khám trực tuyến.`,
      ),
    );

    return buildOpenGraph({
      title: `${department.name} - Chuyên khoa`,
      description,
      path: `/chuyen-khoa/${slug}`,
      image: department.image,
    });
  } catch {
    return buildNoIndexMetadata({
      title: "Chi tiết chuyên khoa",
      description: "Thông tin chuyên khoa, bác sĩ và gói khám tại cơ sở khám.",
    });
  }
}

export default async function PublicDepartmentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let department: PublicDepartment;
  let doctors: DoctorProfile[] = [];
  let packages: MedicalPackage[] = [];
  let summary: PublicDepartmentOverview["summary"] = {
    doctorCount: 0,
    packageCount: 0,
    availableSlotCount: 0,
    reviewSummary: { count: 0, averageRating: 0 },
  };

  try {
    const overview = await serverApiRequest<PublicDepartmentOverview>(
      `/departments/${slug}/overview`,
    );
    department = overview.department;
    doctors = overview.doctors;
    packages = overview.packages;
    summary = overview.summary;
  } catch {
    notFound();
  }

  const bookingUrl = `/dat-lich?departmentId=${department.id}`;
  const doctorsUrl = `/bac-si?departmentId=${department.id}`;
  const description = cleanText(
    department.description,
    "Chuyên khoa đang tiếp nhận lịch khám, tư vấn điều trị và điều phối bác sĩ phù hợp với nhu cầu của người khám.",
  );
  const anchors = sectionAnchors(department.sections);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: department.name,
    description,
    url: absoluteUrl(`/chuyen-khoa/${slug}`),
    lastReviewed: department.contentUpdatedAt ? department.contentUpdatedAt.slice(0, 10) : undefined,
    reviewedBy: department.contentReviewerName ? { "@type": "Person", name: department.contentReviewerName } : undefined,
    about: {
      "@type": "MedicalSpecialty",
      name: department.name,
    },
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Chuyên khoa", path: "/chuyen-khoa" },
    { name: department.name, path: `/chuyen-khoa/${slug}` },
  ]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />

      <section className="ui-container py-5 sm:py-8">
        <PublicBreadcrumb current={department.name} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0">
            <header>
              <h1 className="text-2xl font-bold sm:text-3xl">{department.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">{description}</p>
              <TrustLine updatedAt={department.contentUpdatedAt} reviewerName={department.contentReviewerName} />
              <p className="mt-3 text-sm text-[var(--public-muted)]">
                {summary.doctorCount} bác sĩ có lịch · {summary.packageCount} gói khám · {summary.availableSlotCount} khung giờ trong 14 ngày
                {summary.reviewSummary.count ? ` · ${summary.reviewSummary.averageRating.toFixed(1)} sao (${summary.reviewSummary.count} đánh giá)` : ""}
              </p>
              {department.image ? (
                <img src={department.image} alt={department.name} decoding="async" fetchPriority="high" className="mt-5 aspect-[2/1] w-full rounded-2xl object-cover" />
              ) : null}
            </header>

        <AnchorNav items={[...anchors.map((item) => ({ id: item.id, label: item.title })), { id: "goi-kham", label: "Gói khám" }, { id: "bac-si", label: "Bác sĩ" }]} />
        <IntroSections sections={department.sections} />

        {department.symptomKeywords?.length || department.triageDescription ? (
          <section aria-labelledby="nhu-cau-kham" className="mt-8 border-t border-[var(--public-divider)] pt-6">
            <h2 id="nhu-cau-kham" className="text-xl font-bold">Nên đến khám khi</h2>
            {department.symptomKeywords?.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {department.symptomKeywords.map((keyword) => (
                  <li key={keyword} className="rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3 py-1.5 text-sm">{keyword}</li>
                ))}
              </ul>
            ) : null}
            {department.triageDescription ? <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">{department.triageDescription}</p> : null}
          </section>
        ) : null}

        <section id="bac-si" aria-labelledby="bac-si-title" className="mt-8 border-t border-[var(--public-divider)] pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="bac-si-title" className="text-xl font-bold">Bác sĩ thuộc chuyên khoa</h2>
            <Link href={doctorsUrl} className="text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem tất cả</Link>
          </div>
          {doctors.length ? (
            <ul className="mt-3 divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
              {doctors.slice(0, 6).map((doctor) => (
                <li key={doctor.id}>
                  <Link href={getPublicDoctorPath(doctor)} className="flex items-center gap-3 p-3 hover:bg-[var(--public-surface-muted)] sm:p-4">
                    {doctor.user.avatar ? (
                      <img src={doctor.user.avatar} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)] text-lg font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">{firstLetter(doctor.user.fullName)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{doctorDisplayName(doctor)}</span>
                      <span className="block truncate text-sm text-[var(--public-muted)]">{doctor.specialization || "Khám chuyên khoa"} · {doctor.experience || 0} năm kinh nghiệm</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState label="Chưa có bác sĩ hiển thị cho chuyên khoa này." />
          )}
        </section>

        <section id="goi-kham" aria-labelledby="goi-kham-title" className="mt-8 border-t border-[var(--public-divider)] pt-6">
          <h2 id="goi-kham-title" className="text-xl font-bold">Gói khám liên quan</h2>
          {packages.length ? (
            <ul className="mt-3 divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
              {packages.slice(0, 4).map((item) => (
                <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{item.slug ? <Link href={`/goi-kham/${item.slug}`} className="hover:text-[var(--public-primary)]">{item.name}</Link> : item.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--public-muted)]">{item.summary || item.description || "Gói khám được thiết kế theo nhu cầu chuyên khoa."}</p>
                    <p className="mt-1 text-sm text-[var(--public-muted)]">{item.items.length} hạng mục{item.isBHYTSupport ? " · Hỗ trợ BHYT" : ""}{item.isPopular ? " · Nổi bật" : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                    <p className="text-lg font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</p>
                    <Link href={`/dat-lich?departmentId=${department.id}&packageId=${item.id}`} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Chọn gói</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState label="Chưa có gói khám riêng cho chuyên khoa này." />
          )}
        </section>
          </div>

          <aside aria-labelledby="dat-lich-title" className="hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5 lg:sticky lg:top-24 lg:block">
            <h2 id="dat-lich-title" className="text-lg font-semibold">Đặt lịch {department.name}</h2>
            <p className="mt-1 text-base leading-7 text-[var(--public-text-soft)]">Chọn bác sĩ và giờ còn trống.</p>
            <div className="mt-4 space-y-2">
              <Link href={bookingUrl} className="public-button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold">
                Đặt lịch
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={doctorsUrl} className="public-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold">Xem bác sĩ</Link>
              <AskKunButton label="Hỏi Kun về chuyên khoa này" />
            </div>
          </aside>
        </div>
      </section>

      {/* Điện thoại: thanh nút cố định dưới màn hình, dùng chung kiểu với trang đặt lịch (ẩn thanh điều hướng dưới khi có). */}
      <div className="lg:hidden">
        <div className="booking-action-bar">
          <div className="booking-action-bar__inner">
            <Link href={bookingUrl} className="public-button-primary inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold">
              Đặt lịch
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="mt-3 rounded-lg border border-dashed border-[var(--public-border)] p-5 text-center text-sm text-[var(--public-muted)]">{label}</p>;
}

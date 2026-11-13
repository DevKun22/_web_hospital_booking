/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Clock, HeartPulse, PackageCheck, Star } from "lucide-react";
import Link from "next/link";
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
      description: "Thông tin chuyên khoa, bác sĩ và gói khám tại bệnh viện.",
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: department.name,
    description,
    url: absoluteUrl(`/chuyen-khoa/${slug}`),
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f1faf7_0%,var(--public-canvas)_46%,#ffffff_100%)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />

      <section className="ui-container py-5 sm:py-7">
        <PublicBreadcrumb current={department.name} />
        <div className="space-y-6 sm:space-y-8">
          <article className="grid overflow-hidden rounded-3xl border border-[var(--public-border)] bg-white shadow-[var(--public-shadow-soft)] lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1fr)]">
            <div className="p-4 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--public-primary)]">Chuyên khoa</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight sm:mt-2 sm:text-3xl lg:text-4xl">{department.name}</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--public-muted)] sm:mt-4 sm:leading-7">{description}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3 lg:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Bác sĩ có lịch" value={summary.doctorCount} />
                <MetricCard label="Gói khám" value={summary.packageCount} />
                <MetricCard label="Khung giờ 14 ngày" value={summary.availableSlotCount} />
                <MetricCard
                  label={summary.reviewSummary.count ? `${summary.reviewSummary.count} đánh giá` : "Chưa có đánh giá"}
                  value={summary.reviewSummary.count ? summary.reviewSummary.averageRating.toFixed(1) : "—"}
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:gap-3">
                <Link href={bookingUrl} className="public-button-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  Đặt lịch chuyên khoa này
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={doctorsUrl} className="public-button-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  Xem bác sĩ
                </Link>
              </div>
            </div>

            <div className="min-h-52 bg-[var(--public-primary-soft)] sm:min-h-64 lg:min-h-80">
              {department.image ? (
                <img src={department.image} alt={department.name} decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-52 items-center justify-center text-[var(--public-primary)] sm:min-h-64 lg:min-h-80">
                  <HeartPulse className="h-16 w-16" />
                </div>
              )}
            </div>
          </article>

          <nav aria-label="Nội dung chuyên khoa" className="sticky top-[var(--public-header-offset,0px)] z-20 overflow-x-auto rounded-xl border border-[var(--public-border)] bg-white/95 p-2 shadow-sm backdrop-blur">
            <div className="flex min-w-max gap-1">
              <AnchorLink href="#tong-quan">Tổng quan</AnchorLink>
              <AnchorLink href="#nhu-cau-kham">Nhu cầu khám</AnchorLink>
              <AnchorLink href="#bac-si">Bác sĩ</AnchorLink>
              <AnchorLink href="#goi-kham">Gói khám</AnchorLink>
            </div>
          </nav>

          <section id="tong-quan" className="scroll-mt-36 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <article className="public-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">Tổng quan chuyên khoa</p>
              <h2 className="mt-2 text-2xl font-bold">Thông tin tiếp nhận và định hướng khám</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--public-muted)] sm:text-base">{description}</p>
            </article>
            <aside id="nhu-cau-kham" className="public-card scroll-mt-36 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">Nhu cầu khám thường gặp</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(department.symptomKeywords || []).map((keyword) => (
                  <span key={keyword} className="rounded-lg border border-[var(--public-border)] bg-[var(--public-surface-muted)] px-3 py-2 text-sm font-medium">{keyword}</span>
                ))}
                {!department.symptomKeywords?.length ? <span className="text-sm text-[var(--public-muted)]">Nội dung đang được cập nhật.</span> : null}
              </div>
              {department.triageDescription ? <p className="mt-4 border-t border-[var(--public-border)] pt-4 text-sm leading-6 text-[var(--public-muted)]">{department.triageDescription}</p> : null}
            </aside>
          </section>

          <section id="bac-si" className="scroll-mt-36">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--public-muted)]">Bác sĩ</p>
                <h2 className="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl">Bác sĩ thuộc chuyên khoa</h2>
              </div>
              <Link href={doctorsUrl} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--public-primary)]">
                Xem tất cả
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {doctors.length ? doctors.slice(0, 4).map((doctor) => (
                <article key={doctor.id} className="public-card p-4">
                  <div className="flex items-center gap-3">
                    {doctor.user.avatar ? (
                      <img src={doctor.user.avatar} alt={doctor.user.fullName} loading="lazy" decoding="async" className="h-14 w-14 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-lg font-semibold text-[var(--public-primary)]">{firstLetter(doctor.user.fullName)}</div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{doctorDisplayName(doctor)}</h3>
                      <p className="truncate text-sm text-[var(--public-muted)]">{doctor.specialization || "Khám chuyên khoa"}</p>
                    </div>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-[var(--public-muted)]"><Clock className="h-4 w-4 text-[var(--public-primary)]" />{doctor.experience || 0} năm kinh nghiệm</p>
                  <p className="mt-3 font-semibold text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</p>
                  <Link href={getPublicDoctorPath(doctor)} className="public-button-secondary mt-4 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold">
                    Xem chi tiết
                  </Link>
                </article>
              )) : (
                <EmptyState label="Chưa có bác sĩ hiển thị cho chuyên khoa này." />
              )}
            </div>
          </section>

          <section id="goi-kham" className="scroll-mt-36">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--public-muted)]">Gói khám</p>
              <h2 className="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl">Gói khám liên quan</h2>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {packages.length ? packages.slice(0, 3).map((item) => (
                <article key={item.id} className="public-card flex flex-col p-4 sm:min-h-[260px] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      <p className="mt-1 text-sm text-[var(--public-muted)]">{item.summary || item.description || "Gói khám được thiết kế theo nhu cầu chuyên khoa."}</p>
                    </div>
                    {item.isPopular ? <span className="inline-flex items-center gap-1 rounded-md bg-[#fff4d6] px-2 py-1 text-xs font-semibold text-[#8a5a00]"><Star className="h-3.5 w-3.5" />Phổ biến</span> : null}
                  </div>
                  <p className="mt-5 text-2xl font-bold text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    {item.isBHYTSupport ? <span className="rounded-md bg-[#e7f6ed] px-2 py-1 text-[#1f7a3a]">Hỗ trợ BHYT</span> : null}
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f5f9] px-2 py-1 text-[#42526b]"><PackageCheck className="h-3.5 w-3.5" />{item.items.length} hạng mục</span>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                    {item.slug ? (
                      <Link href={`/goi-kham/${item.slug}`} className="public-button-secondary rounded-xl px-3 py-2.5 text-center text-sm font-semibold">
                        Chi tiết
                      </Link>
                    ) : (
                      <span className="rounded-md border border-[#e5ebf3] px-3 py-2.5 text-center text-sm font-semibold text-[#94a3b8]">Chi tiết</span>
                    )}
                    <Link href={`/dat-lich?departmentId=${department.id}&packageId=${item.id}`} className="public-button-primary rounded-xl px-3 py-2.5 text-center text-sm font-semibold">
                      Chọn gói
                    </Link>
                  </div>
                </article>
              )) : (
                <EmptyState label="Chưa có gói khám riêng cho chuyên khoa này." />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4">
      <p className="text-2xl font-bold text-[var(--public-primary-dark)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--public-muted)]">{label}</p>
    </div>
  );
}

function AnchorLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-[var(--public-muted)] transition hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-primary)]">{children}</a>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--public-border)] bg-white p-6 text-center text-sm text-[var(--public-muted)] sm:col-span-2 lg:col-span-3 xl:col-span-4">{label}</div>;
}

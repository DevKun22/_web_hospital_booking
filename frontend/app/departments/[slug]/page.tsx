/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight, Clock, HeartPulse, PackageCheck, Star } from "lucide-react";
import Link from "next/link";
import { PublicBreadcrumb, PublicPageHeader } from "@/components/public/public-page-layout";
import type { PublicDepartment } from "@/components/public/public-home-types";
import { serverApiRequest } from "@/lib/server-api";
import { buildOpenGraph, cleanText, jsonLdString, truncateText, absoluteUrl } from "@/lib/seo";
import type { DoctorProfile, MedicalPackage } from "@/lib/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const doctorName = (doctor: DoctorProfile) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");
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
      path: `/departments/${slug}`,
      image: department.image,
    });
  } catch {
    return {
      title: "Chi tiết chuyên khoa",
      description: "Thông tin chuyên khoa, bác sĩ và gói khám tại bệnh viện.",
    };
  }
}

export default async function PublicDepartmentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let department: PublicDepartment;
  let doctors: DoctorProfile[] = [];
  let packages: MedicalPackage[] = [];

  try {
    const [departmentResult, doctorItems, packageItems] = await Promise.all([
      getDepartment(slug),
      serverApiRequest<DoctorProfile[]>("/doctors", { query: { departmentSlug: slug } }),
      serverApiRequest<MedicalPackage[]>("/packages"),
    ]);
    department = departmentResult;
    doctors = doctorItems;
    packages = packageItems.filter((item) => item.department?.id === department.id);
  } catch {
    notFound();
  }

  const bookingUrl = `/?departmentId=${department.id}#booking`;
  const doctorsUrl = `/doctors?departmentId=${department.id}`;
  const description = cleanText(
    department.description,
    "Chuyên khoa đang tiếp nhận lịch khám, tư vấn điều trị và điều phối bác sĩ phù hợp với nhu cầu của người bệnh.",
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: department.name,
    description,
    url: absoluteUrl(`/departments/${slug}`),
    about: {
      "@type": "MedicalSpecialty",
      name: department.name,
    },
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#f6f8fb_46%,#ffffff_100%)] text-[#172033]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <PublicPageHeader />

      <section className="ui-container py-8 sm:py-10">
        <PublicBreadcrumb current={department.name} />
        <div className="space-y-8">
          <article className="grid overflow-hidden rounded-xl border border-[#cfe0f3] bg-white/95 shadow-[0_18px_48px_rgba(13,79,139,0.10)] ring-1 ring-[#e7f0fb] lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1fr)]">
            <div className="p-5 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">Chuyên khoa</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{department.name}</h1>
              <p className="mt-4 text-sm leading-7 text-[#667892]">{description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Bác sĩ" value={doctors.length} />
                <MetricCard label="Gói khám" value={packages.length} />
                <MetricCard label="Đang hoạt động" value="Có" />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href={bookingUrl} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(13,79,139,0.22)] transition hover:-translate-y-0.5 hover:bg-[#083d6d]">
                  Đặt lịch chuyên khoa này
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={doctorsUrl} className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] bg-white px-5 py-3 text-sm font-semibold text-[#42526b] transition hover:-translate-y-0.5 hover:bg-[#f8fafc]">
                  Xem bác sĩ
                </Link>
              </div>
            </div>

            <div className="min-h-80 bg-[#e7f0fb]">
              {department.image ? (
                <img src={department.image} alt={department.name} decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-80 items-center justify-center text-[#0d4f8b]">
                  <HeartPulse className="h-16 w-16" />
                </div>
              )}
            </div>
          </article>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">Bác sĩ</p>
                <h2 className="mt-2 text-3xl font-semibold">Bác sĩ thuộc chuyên khoa</h2>
              </div>
              <Link href={doctorsUrl} className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]">
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#e7f0fb] text-lg font-semibold text-[#0d4f8b]">{firstLetter(doctor.user.fullName)}</div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{doctorName(doctor)}</h3>
                      <p className="truncate text-sm text-[#667892]">{doctor.specialization || "Khám chuyên khoa"}</p>
                    </div>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-[#667892]"><Clock className="h-4 w-4 text-[#0d4f8b]" />{doctor.experience || 0} năm kinh nghiệm</p>
                  <p className="mt-3 font-semibold text-[#0d4f8b]">{formatCurrency(doctor.consultationFee)}</p>
                  <Link href={`/doctors/${doctor.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">
                    Xem chi tiết
                  </Link>
                </article>
              )) : (
                <EmptyState label="Chưa có bác sĩ hiển thị cho chuyên khoa này." />
              )}
            </div>
          </section>

          <section>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">Gói khám</p>
              <h2 className="mt-2 text-3xl font-semibold">Gói khám liên quan</h2>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {packages.length ? packages.slice(0, 3).map((item) => (
                <article key={item.id} className="public-card flex min-h-[260px] flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      <p className="mt-1 text-sm text-[#667892]">{item.summary || item.description || "Gói khám được thiết kế theo nhu cầu chuyên khoa."}</p>
                    </div>
                    {item.isPopular ? <span className="inline-flex items-center gap-1 rounded-md bg-[#fff4d6] px-2 py-1 text-xs font-semibold text-[#8a5a00]"><Star className="h-3.5 w-3.5" />Phổ biến</span> : null}
                  </div>
                  <p className="mt-5 text-2xl font-semibold text-[#0d4f8b]">{formatCurrency(item.finalPrice)}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    {item.isBHYTSupport ? <span className="rounded-md bg-[#e7f6ed] px-2 py-1 text-[#1f7a3a]">Hỗ trợ BHYT</span> : null}
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f5f9] px-2 py-1 text-[#42526b]"><PackageCheck className="h-3.5 w-3.5" />{item.items.length} hạng mục</span>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                    {item.slug ? (
                      <Link href={`/packages/${item.slug}`} className="rounded-md border border-[#cfd8e6] px-3 py-2.5 text-center text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">
                        Chi tiết
                      </Link>
                    ) : (
                      <span className="rounded-md border border-[#e5ebf3] px-3 py-2.5 text-center text-sm font-semibold text-[#94a3b8]">Chi tiết</span>
                    )}
                    <Link href={`/?departmentId=${department.id}&packageId=${item.id}#booking`} className="rounded-md bg-[#0d4f8b] px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#083d6d]">
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
    <div className="rounded-lg border border-[#d8e9ff] bg-[#f8fbff] p-4">
      <p className="text-2xl font-semibold text-[#0d4f8b]">{value}</p>
      <p className="mt-1 text-sm text-[#667892]">{label}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-[#cfe0f3] bg-white/90 p-6 text-center text-sm text-[#667892] sm:col-span-2 lg:col-span-3 xl:col-span-4">{label}</div>;
}

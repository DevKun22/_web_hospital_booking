import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { DoctorDetailClient, type PublicSlot } from "@/app/doctors/[id]/doctor-detail-client";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { getVietnamDateInput } from "@/lib/date";
import { serverApiRequest } from "@/lib/server-api";
import { absoluteUrl, buildBreadcrumbJsonLd, buildNoIndexMetadata, buildOpenGraph, cleanText, jsonLdString, truncateText } from "@/lib/seo";
import type { DoctorProfile } from "@/lib/types";

type PageProps = { params: Promise<{ slug: string }> };

const doctorName = (doctor: DoctorProfile) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");
const getDoctor = cache(async (identifier: string) => serverApiRequest<DoctorProfile>(`/doctors/${identifier}`));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const doctor = await getDoctor(slug);
    const name = doctorName(doctor);
    const description = truncateText(cleanText(
      doctor.bio || doctor.specialization,
      `${name} thuộc ${doctor.department.name}. Xem chuyên môn, phí khám và lịch trống để đặt lịch trực tuyến.`,
    ));

    return buildOpenGraph({
      title: `${name} - ${doctor.department.name}`,
      description,
      path: `/bac-si/${doctor.slug || slug}`,
      image: doctor.user.avatar,
    });
  } catch {
    return buildNoIndexMetadata({
      title: "Thông tin bác sĩ",
      description: "Thông tin chuyên môn, phí khám và lịch khám trống của bác sĩ.",
    });
  }
}

export default async function PublicDoctorDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const today = getVietnamDateInput();
  let doctor: DoctorProfile;

  try {
    doctor = await getDoctor(slug);
  } catch {
    notFound();
  }

  const canonicalSlug = doctor.slug || slug;
  if (slug !== canonicalSlug) permanentRedirect(`/bac-si/${canonicalSlug}`);

  const slots = await serverApiRequest<PublicSlot[]>(`/doctors/${doctor.id}/available-slots`, {
    query: { date: today },
  }).catch(() => []);
  const name = doctorName(doctor);
  const canonicalPath = `/bac-si/${canonicalSlug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    url: absoluteUrl(canonicalPath),
    image: absoluteUrl(doctor.user.avatar),
    description: cleanText(doctor.bio || doctor.specialization, `${name} thuộc ${doctor.department.name}.`),
    medicalSpecialty: doctor.specialization || doctor.department.name,
    worksFor: { "@type": "MedicalOrganization", name: "Hospital Booking", url: absoluteUrl("/") },
    aggregateRating: doctor.reviewSummary?.count ? {
      "@type": "AggregateRating",
      ratingValue: doctor.reviewSummary.averageRating,
      reviewCount: doctor.reviewSummary.count,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Bác sĩ", path: "/bac-si" },
    { name, path: canonicalPath },
  ]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f1faf7_0%,var(--public-canvas)_46%,#ffffff_100%)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
      <section className="ui-container py-8 sm:py-10">
        <PublicBreadcrumb current={name} />
        <DoctorDetailClient doctor={doctor} initialDate={today} initialSlots={slots} />
      </section>
    </main>
  );
}

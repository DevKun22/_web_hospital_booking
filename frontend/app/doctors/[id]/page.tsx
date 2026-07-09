import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DoctorDetailClient, type PublicSlot } from "@/app/doctors/[id]/doctor-detail-client";
import { PublicBreadcrumb, PublicPageHeader } from "@/components/public/public-page-layout";
import { getVietnamDateInput } from "@/lib/date";
import { serverApiRequest } from "@/lib/server-api";
import { absoluteUrl, buildOpenGraph, cleanText, jsonLdString, truncateText } from "@/lib/seo";
import type { DoctorProfile } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

const doctorName = (doctor: DoctorProfile) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const getDoctor = cache(async (id: string) => {
  return serverApiRequest<DoctorProfile>(`/doctors/${id}`);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const doctor = await getDoctor(id);
    const name = doctorName(doctor);
    const description = truncateText(
      cleanText(
        doctor.bio || doctor.specialization,
        `${name} thuộc ${doctor.department.name}. Xem thông tin bác sĩ, phí khám và lịch trống để đặt lịch trực tuyến.`,
      ),
    );

    return buildOpenGraph({
      title: `${name} - Bác sĩ`,
      description,
      path: `/doctors/${id}`,
      image: doctor.user.avatar,
    });
  } catch {
    return {
      title: "Chi tiết bác sĩ",
      description: "Thông tin bác sĩ, chuyên khoa, phí khám và lịch khám trống.",
    };
  }
}

export default async function PublicDoctorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const today = getVietnamDateInput();
  let doctor: DoctorProfile;
  let slots: PublicSlot[] = [];

  try {
    const [doctorResult, slotResult] = await Promise.all([
      getDoctor(id),
      serverApiRequest<PublicSlot[]>(`/doctors/${id}/available-slots`, {
        query: { date: today },
      }).catch(() => []),
    ]);
    doctor = doctorResult;
    slots = slotResult;
  } catch {
    notFound();
  }

  const name = doctorName(doctor);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    url: absoluteUrl(`/doctors/${doctor.id}`),
    image: absoluteUrl(doctor.user.avatar),
    description: cleanText(doctor.bio || doctor.specialization, `${name} thuộc ${doctor.department.name}.`),
    medicalSpecialty: doctor.specialization || doctor.department.name,
    worksFor: {
      "@type": "MedicalOrganization",
      name: "Hospital Booking",
      url: absoluteUrl("/"),
    },
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#f6f8fb_46%,#ffffff_100%)] text-[#172033]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <PublicPageHeader />

      <section className="ui-container py-8 sm:py-10">
        <PublicBreadcrumb current={name} />
        <DoctorDetailClient doctor={doctor} initialDate={today} initialSlots={slots} />
      </section>
    </main>
  );
}

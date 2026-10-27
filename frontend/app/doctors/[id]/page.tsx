import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { serverApiRequest } from "@/lib/server-api";
import { buildNoIndexMetadata, buildOpenGraph, cleanText, truncateText } from "@/lib/seo";
import type { DoctorProfile } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

const doctorName = (doctor: DoctorProfile) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const getDoctor = cache(async (id: string) => {
  return serverApiRequest<DoctorProfile>(`/doctors/${id}`, {
    query: { canonical: "slug" },
  });
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
    return buildNoIndexMetadata({
      title: "Chi tiết bác sĩ",
      description: "Thông tin bác sĩ, chuyên khoa, phí khám và lịch khám trống.",
    });
  }
}

export default async function PublicDoctorDetailPage({ params }: PageProps) {
  const { id } = await params;
  let doctor: DoctorProfile;

  try {
    doctor = await getDoctor(id);
  } catch {
    notFound();
  }

  permanentRedirect(`/bac-si/${doctor.slug || doctor.id}`);
}

import type { DoctorProfile } from "@/lib/types";

type PublicDoctorRoute = Pick<DoctorProfile, "id" | "slug">;

export const getPublicDoctorPath = (doctor: PublicDoctorRoute) =>
  `/bac-si/${encodeURIComponent(doctor.slug || doctor.id)}`;

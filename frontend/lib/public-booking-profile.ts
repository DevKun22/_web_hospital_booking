"use client";

import type { PatientUser } from "@/lib/patient-portal-types";
import type { PublicBookingDraft } from "@/lib/public-booking-store";

export function buildPatientBookingPrefill(
  current: PublicBookingDraft,
  user: PatientUser,
): Partial<PublicBookingDraft> {
  const profile = user.patientProfile;
  const values: Partial<PublicBookingDraft> = {
    patientName: user.fullName || "",
    patientPhone: user.phone || "",
    patientEmail: user.email || "",
    gender: profile?.gender || "",
    dateOfBirth: profile?.dateOfBirth?.slice(0, 10) || "",
    address: profile?.address || "",
    cccd: profile?.cccd || "",
    healthInsuranceCode: profile?.healthInsuranceCode || "",
    registeredHospital: profile?.registeredHospital || "",
    allergies: profile?.allergies || "",
    medicalHistory: profile?.medicalHistory || "",
    familyHistory: profile?.familyHistory || "",
  };
  const patch: Partial<PublicBookingDraft> = {};

  for (const [key, value] of Object.entries(values) as Array<
    [keyof PublicBookingDraft, PublicBookingDraft[keyof PublicBookingDraft]]
  >) {
    if (
      typeof value === "string" &&
      value.trim() &&
      !String(current[key] || "").trim()
    ) {
      Object.assign(patch, { [key]: value });
    }
  }

  if (profile?.hasBHYT && !current.hasBHYT) patch.hasBHYT = true;
  return patch;
}

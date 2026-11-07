"use client";

import type { PatientUser } from "@/lib/patient-portal-types";

type SessionEnvelope = { data?: PatientUser; message?: string };

export const patientSessionQueryKey = ["patient-session"] as const;

export async function loadOptionalPatientSession(): Promise<PatientUser | null> {
  const response = await fetch("/api/nguoi-kham/phien", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) return null;

  const payload = (await response.json().catch(() => null)) as SessionEnvelope | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "Không thể tải phiên người khám.");
  }
  return payload.data;
}

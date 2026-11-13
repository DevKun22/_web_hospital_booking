"use client";

import { PatientApiError, patientApiRequest } from "@/lib/patient-portal-api";
import type { PatientUser } from "@/lib/patient-portal-types";

export const patientSessionQueryKey = ["patient-session"] as const;

export async function loadOptionalPatientSession(): Promise<PatientUser | null> {
  try {
    return (await patientApiRequest<PatientUser>("/phien")).data;
  } catch (error) {
    if (error instanceof PatientApiError && error.status === 401) return null;
    throw error;
  }
}

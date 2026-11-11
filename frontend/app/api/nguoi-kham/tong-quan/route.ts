import { NextResponse } from "next/server";
import {
  clearPatientSessionCookies,
  getPatientAccessToken,
  getAuthorizedPatientRequest,
  patientErrorResponse,
  setPatientSessionCookies,
} from "@/lib/patient-session-server";
import type {
  PatientAppointment,
  PatientDependent,
  PatientInvoice,
  PatientMedicalRecord,
  PatientPortalOverview,
  PatientPrescription,
  PatientSession,
  PatientUser,
} from "@/lib/patient-portal-types";

type Envelope<T> = { data?: T; meta?: { total?: number } };

async function authorized<T>(path: string, accessToken: string) {
  const response = await fetch(
    `${(process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(/\/$/, "")}${path}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    },
  );
  return { response, payload: (await response.json().catch(() => null)) as Envelope<T> | null };
}

export async function GET() {
  const profile = await getAuthorizedPatientRequest<PatientUser>("/me");
  if (!profile.response.ok || !profile.payload?.data) {
    const response = patientErrorResponse(profile.payload, profile.response.status || 401);
    if (profile.response.status === 401) clearPatientSessionCookies(response);
    return response;
  }

  const accessToken = profile.rotated?.accessToken;
  const token = accessToken || (await getPatientAccessToken());
  if (!token) return NextResponse.json({ success: false, message: "Vui lòng đăng nhập." }, { status: 401 });

  const [appointments, records, prescriptions, invoices, dependents, sessions] = await Promise.all([
    authorized<PatientAppointment[]>("/me/appointments?page=1&limit=10", token),
    authorized<PatientMedicalRecord[]>("/me/medical-records?page=1&limit=3", token),
    authorized<PatientPrescription[]>("/me/prescriptions?page=1&limit=3", token),
    authorized<PatientInvoice[]>("/me/invoices?page=1&limit=3", token),
    authorized<PatientDependent[]>("/me/dependents", token),
    authorized<PatientSession[]>("/auth/sessions", token),
  ]);

  const failed = [appointments, records, prescriptions, invoices, dependents, sessions].find(
    (item) => !item.response.ok,
  );
  if (failed) return patientErrorResponse(failed.payload, failed.response.status);

  const collection = <T,>(payload: Envelope<T[]> | null) => ({
    items: payload?.data || [],
    total: payload?.meta?.total ?? payload?.data?.length ?? 0,
  });
  const data: PatientPortalOverview = {
    profile: profile.payload.data,
    appointments: collection(appointments.payload),
    medicalRecords: collection(records.payload),
    prescriptions: collection(prescriptions.payload),
    invoices: collection(invoices.payload),
    dependents: dependents.payload?.data || [],
    sessions: sessions.payload?.data || [],
  };
  const response = NextResponse.json({ success: true, data });
  if (profile.rotated) setPatientSessionCookies(response, profile.rotated);
  return response;
}


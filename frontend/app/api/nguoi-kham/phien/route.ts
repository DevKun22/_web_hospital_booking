import { NextResponse } from "next/server";
import {
  clearPatientSessionCookies,
  getAuthorizedPatientRequest,
  patientErrorResponse,
  setPatientSessionCookies,
} from "@/lib/patient-session-server";
import type { PatientUser } from "@/lib/patient-portal-types";

export async function GET() {
  const result = await getAuthorizedPatientRequest<PatientUser>("/v1/me");
  if (!result.response.ok || !result.payload?.data) {
    const response = patientErrorResponse(result.payload, result.response.status || 401);
    if (result.response.status === 401) clearPatientSessionCookies(response);
    return response;
  }
  const response = NextResponse.json({ success: true, data: result.payload.data });
  if (result.rotated) setPatientSessionCookies(response, result.rotated);
  return response;
}


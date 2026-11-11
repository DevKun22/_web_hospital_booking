import { NextResponse } from "next/server";
import {
  backendRequest,
  patientErrorResponse,
  setPatientSessionCookies,
} from "@/lib/patient-session-server";
import type { PatientUser } from "@/lib/patient-portal-types";

type VerifyResult = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: PatientUser;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    challengeId?: string;
    otp?: string;
  } | null;
  if (!body?.challengeId || !/^\d{6}$/.test(body.otp || "")) {
    return NextResponse.json(
      { success: false, message: "Mã xác thực phải gồm 6 chữ số." },
      { status: 400 },
    );
  }

  const result = await backendRequest<VerifyResult>("/auth/patient/verify-otp", {
    method: "POST",
    body: JSON.stringify({
      challengeId: body.challengeId,
      otp: body.otp,
      platform: "web",
      deviceName: "Trình duyệt Web",
    }),
  });
  if (!result.response.ok || !result.payload?.data) {
    return patientErrorResponse(result.payload, result.response.status);
  }

  const response = NextResponse.json({
    success: true,
    data: { user: result.payload.data.user },
  });
  setPatientSessionCookies(response, result.payload.data);
  return response;
}


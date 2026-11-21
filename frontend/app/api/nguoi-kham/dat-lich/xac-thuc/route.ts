import { NextResponse } from "next/server";
import { buildWebDeviceName } from "@/lib/device-label";
import {
  backendRequest,
  patientErrorResponse,
  setPatientSessionCookies,
} from "@/lib/patient-session-server";
import type { PatientUser } from "@/lib/patient-portal-types";

type VerifiedSession = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: PatientUser;
};

// Xác thực OTP đặt lịch và, nếu máy chủ cấp được, đăng nhập luôn cổng người khám (cookie httpOnly) để khỏi nhập OTP lần hai.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { appointmentId?: string; otp?: string } | null;
  if (!body?.appointmentId || !/^[\w-]{8,64}$/.test(body.appointmentId) || !/^\d{6}$/.test(body.otp || "")) {
    return NextResponse.json({ success: false, message: "Mã xác thực phải gồm 6 chữ số." }, { status: 400 });
  }

  const result = await backendRequest<Record<string, unknown> & { session?: VerifiedSession }>(
    `/appointments/${encodeURIComponent(body.appointmentId)}/verify-otp`,
    {
      method: "POST",
      body: JSON.stringify({ otp: body.otp, issueSession: true, platform: "web", deviceName: buildWebDeviceName(request.headers) }),
    },
  );
  if (!result.response.ok || !result.payload?.data) {
    return patientErrorResponse(result.payload, result.response.status);
  }

  const { session, ...appointment } = result.payload.data;
  const response = NextResponse.json({
    success: true,
    data: { appointment, user: session?.user ?? null },
  });
  if (session) setPatientSessionCookies(response, session);
  return response;
}

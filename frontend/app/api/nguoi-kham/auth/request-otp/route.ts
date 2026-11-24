import { NextResponse } from "next/server";
import { backendRequest, patientErrorResponse } from "@/lib/patient-session-server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; termsAccepted?: boolean; termsVersion?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: "Vui lòng nhập email hợp lệ." }, { status: 400 });
  }

  const result = await backendRequest("/auth/patient/request-otp", {
    method: "POST",
    body: JSON.stringify({ email, termsAccepted: body?.termsAccepted, termsVersion: body?.termsVersion }),
  });
  if (!result.response.ok || !result.payload?.data) {
    return patientErrorResponse(result.payload, result.response.status);
  }
  return NextResponse.json({ success: true, data: result.payload.data });
}


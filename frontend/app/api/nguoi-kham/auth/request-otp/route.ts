import { NextResponse } from "next/server";
import { backendRequest, patientErrorResponse } from "@/lib/patient-session-server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { phone?: string; email?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const phone = body?.phone?.replace(/\D/g, "") || "";
  if (email ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : !/^0\d{9}$/.test(phone)) {
    return NextResponse.json(
      { success: false, message: "Vui lòng nhập số điện thoại 10 chữ số hoặc email hợp lệ." },
      { status: 400 },
    );
  }

  const result = await backendRequest("/auth/patient/request-otp", {
    method: "POST",
    body: JSON.stringify(email ? { email } : { phone }),
  });
  if (!result.response.ok || !result.payload?.data) {
    return patientErrorResponse(result.payload, result.response.status);
  }
  return NextResponse.json({ success: true, data: result.payload.data });
}


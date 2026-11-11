import { NextResponse } from "next/server";
import {
  backendRequest,
  clearPatientSessionCookies,
  getRefreshToken,
} from "@/lib/patient-session-server";

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await backendRequest("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }
  const response = NextResponse.json({ success: true, data: null });
  clearPatientSessionCookies(response);
  return response;
}


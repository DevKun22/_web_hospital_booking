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
  PatientInvoice,
  PatientMedicalRecord,
  PatientPortalOverview,
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

// Chỉ lấy phần trang tổng quan thực sự hiển thị; ba yêu cầu chạy song song.
const loadOverview = (token: string) =>
  Promise.all([
    authorized<PatientAppointment[]>("/me/appointments?page=1&limit=10", token),
    authorized<PatientMedicalRecord[]>("/me/medical-records?page=1&limit=3", token),
    authorized<PatientInvoice[]>("/me/invoices?page=1&limit=3", token),
  ]);

export async function GET() {
  // Đường nhanh: dùng ngay token đang có. Trang chỉ gọi sau khi bước kiểm tra phiên đã làm mới token nếu cần.
  let token = await getPatientAccessToken();
  let results = token ? await loadOverview(token) : null;
  let rotated: Awaited<ReturnType<typeof getAuthorizedPatientRequest<PatientUser>>>["rotated"] = null;

  // Token thiếu hoặc hết hạn: làm mới phiên (một lần) rồi gọi lại.
  if (!results || results.some((item) => item.response.status === 401)) {
    const gate = await getAuthorizedPatientRequest<PatientUser>("/me");
    if (!gate.response.ok) {
      const response = patientErrorResponse(gate.payload, gate.response.status || 401);
      if (gate.response.status === 401) clearPatientSessionCookies(response);
      return response;
    }
    rotated = gate.rotated;
    token = rotated?.accessToken || (await getPatientAccessToken());
    if (!token) return NextResponse.json({ success: false, message: "Vui lòng đăng nhập." }, { status: 401 });
    results = await loadOverview(token);
  }

  const [appointments, records, invoices] = results;
  const failed = [appointments, records, invoices].find((item) => !item.response.ok);
  if (failed) return patientErrorResponse(failed.payload, failed.response.status);

  const collection = <T,>(payload: Envelope<T[]> | null) => ({
    items: payload?.data || [],
    total: payload?.meta?.total ?? payload?.data?.length ?? 0,
  });
  const data: PatientPortalOverview = {
    appointments: collection(appointments.payload),
    medicalRecords: collection(records.payload),
    invoices: collection(invoices.payload),
  };
  const response = NextResponse.json({ success: true, data });
  if (rotated) setPatientSessionCookies(response, rotated);
  return response;
}

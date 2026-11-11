import { NextResponse } from "next/server";
import {
  clearPatientSessionCookies,
  getAuthorizedPatientRequest,
  patientErrorResponse,
  setPatientSessionCookies,
} from "@/lib/patient-session-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveBackendPath(parts: string[]) {
  const [resource, id, action] = parts;
  if (resource === "ho-so" && parts.length === 1) return "/me";
  if (resource === "lich-hen" && !id) return "/me/appointments";
  if (resource === "lich-hen" && id && UUID.test(id) && !action) return `/me/appointments/${id}`;
  if (resource === "lich-hen" && id && UUID.test(id) && action === "huy") return `/me/appointments/${id}/cancel`;
  if (resource === "lich-hen" && id && UUID.test(id) && action === "danh-gia") return `/me/appointments/${id}/review`;
  if (resource === "nguoi-than" && !id) return "/me/dependents";
  if (resource === "nguoi-than" && id && UUID.test(id) && !action) return `/me/dependents/${id}`;
  if (resource === "ket-qua" && !id) return "/me/medical-records";
  if (resource === "ket-qua" && id && UUID.test(id) && !action) return `/me/medical-records/${id}`;
  if (resource === "don-thuoc" && !id) return "/me/prescriptions";
  if (resource === "don-thuoc" && id && UUID.test(id) && !action) return `/me/prescriptions/${id}`;
  if (resource === "hoa-don" && !id) return "/me/invoices";
  if (resource === "hoa-don" && id && UUID.test(id) && !action) return `/me/invoices/${id}`;
  if (resource === "hoa-don" && id && UUID.test(id) && action === "thanh-toan") return `/me/invoices/${id}/payments`;
  if (resource === "thong-bao" && !id) return "/me/notifications";
  if (resource === "thong-bao" && id === "so-chua-doc" && !action) return "/me/notifications/unread-count";
  if (resource === "thong-bao" && id === "doc-tat-ca" && !action) return "/me/notifications/read-all";
  if (resource === "thong-bao" && id && UUID.test(id) && action === "da-doc") return `/me/notifications/${id}/read`;
  if (resource === "kha-nang-thanh-toan" && parts.length === 1) return "/me/payment-capabilities";
  if (resource === "thanh-toan" && id && UUID.test(id) && !action) return `/me/payments/${id}`;
  if (resource === "phien" && !id) return "/auth/sessions";
  if (resource === "phien" && id && UUID.test(id) && !action) return `/auth/sessions/${id}`;
  return null;
}

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const backendPath = resolveBackendPath(path);
  if (!backendPath) return NextResponse.json({ success: false, message: "Đường dẫn không được hỗ trợ." }, { status: 404 });

  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const method = request.method;
  const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
  const result = await getAuthorizedPatientRequest<unknown>(`${backendPath}${query ? `?${query}` : ""}`, {
    method,
    body: body || undefined,
    headers: {
      ...(body ? { "Content-Type": request.headers.get("content-type") || "application/json" } : {}),
      ...(request.headers.get("idempotency-key") ? { "Idempotency-Key": request.headers.get("idempotency-key")! } : {}),
    },
  });

  if (!result.response.ok) {
    const response = patientErrorResponse(result.payload, result.response.status);
    if (result.response.status === 401) clearPatientSessionCookies(response);
    return response;
  }
  const response = NextResponse.json({
    success: true,
    data: result.payload?.data ?? null,
    meta: result.payload?.meta,
    message: result.payload?.message,
  }, { status: result.response.status });
  if (result.rotated) setPatientSessionCookies(response, result.rotated);
  return response;
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;


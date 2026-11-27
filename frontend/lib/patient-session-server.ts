import "server-only";

import { cookies, headers } from "next/headers";
import { buildWebDeviceName } from "@/lib/device-label";
import { NextResponse } from "next/server";

const API_BASE_URL = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1"
).replace(/\/$/, "");

const ACCESS_COOKIE = "hb_patient_access";
const REFRESH_COOKIE = "hb_patient_refresh";
const ACCESS_MAX_AGE = 15 * 60;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: { total?: number };
  code?: string;
  retryAfterSeconds?: number;
};

type PatientSessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
}

export function backendUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function backendRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(backendUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  return { response, payload: await readJson<T>(response) };
}

export async function getAuthorizedPatientRequest<T>(
  path: string,
  init: RequestInit = {},
) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let rotated: PatientSessionTokens | null = null;

  const request = (token?: string) =>
    backendRequest<T>(path, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  // Cookie access (15 phút) đã hết mà refresh còn: làm mới TRƯỚC khi gọi. Không vậy thì yêu cầu đi không có token; với API
  // cho phép khách (chatbot) máy chủ trả 200 như khách nên không bao giờ có 401 để làm mới, người đang đăng nhập bị coi là khách.
  const shouldRefreshFirst = !accessToken && Boolean(refreshToken);
  let result = shouldRefreshFirst ? null : await request(accessToken);
  if ((!result || result.response.status === 401) && refreshToken) {
    const refresh = await backendRequest<PatientSessionTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken,
        platform: "web",
        deviceName: buildWebDeviceName(await headers()),
      }),
    });

    if (refresh.response.ok && refresh.payload?.data) {
      rotated = refresh.payload.data;
      accessToken = rotated.accessToken;
      result = await request(accessToken);
    } else if (!result) {
      // Chưa gọi lần nào và làm mới thất bại: trả kết quả làm mới (401 khi phiên đã hết hẳn, 5xx khi lỗi tạm thời).
      result = { response: refresh.response, payload: refresh.payload as ApiEnvelope<T> | null };
    }
  }

  return { ...(result as NonNullable<typeof result>), rotated };
}

export async function getAuthorizedPatientRawRequest(path: string) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let rotated: PatientSessionTokens | null = null;
  const request = (token?: string) => fetch(backendUrl(path), {
    cache: "no-store",
    headers: {
      Accept: "application/pdf,image/*,application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let response = await request(accessToken);
  if (response.status === 401 && refreshToken) {
    const refresh = await backendRequest<PatientSessionTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken, platform: "web", deviceName: buildWebDeviceName(await headers()) }),
    });
    if (refresh.response.ok && refresh.payload?.data) {
      rotated = refresh.payload.data;
      accessToken = rotated.accessToken;
      response = await request(accessToken);
    }
  }
  return { response, rotated };
}

export function setPatientSessionCookies(
  response: NextResponse,
  tokens: PatientSessionTokens,
) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    expires: new Date(tokens.refreshExpiresAt),
  });
}

export function clearPatientSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function getPatientAccessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export function patientErrorResponse(
  payload: ApiEnvelope<unknown> | null,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      message: payload?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      code: payload?.code,
      // Số giây phải chờ (vd. gửi lại OTP) để giao diện đếm ngược đúng với máy chủ.
      ...(payload?.retryAfterSeconds ? { retryAfterSeconds: payload.retryAfterSeconds } : {}),
    },
    { status },
  );
}


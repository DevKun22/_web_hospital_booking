"use client";

type PortalEnvelope<T> = {
  success?: boolean;
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage?: boolean;
    unreadCount?: number;
  };
  message?: string;
};

export class PatientApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const PATIENT_API_BASE = "/api/nguoi-kham";
const DEFAULT_ERROR = "Không thể tải dữ liệu. Vui lòng thử lại.";

// Cửa duy nhất để trình duyệt gọi API người khám. Mọi yêu cầu đi qua route handler của Next
// (cookie httpOnly, tự làm mới phiên), không gọi thẳng backend.
export async function patientApiRequest<T>(
  path: string,
  init?: RequestInit & { allowEmpty?: boolean },
) {
  const { allowEmpty, ...request } = init || {};
  const response = await fetch(`${PATIENT_API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...request,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(request.body ? { "Content-Type": "application/json" } : {}),
      ...(request.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as PortalEnvelope<T> | null;
  if (!response.ok || !payload || payload.success === false || (!allowEmpty && payload.data === undefined)) {
    throw new PatientApiError(payload?.message || DEFAULT_ERROR, response.status);
  }
  return { data: payload.data as T, meta: payload.meta };
}

export const patientPortalRequest = <T>(path: string, init?: RequestInit) =>
  patientApiRequest<T>(`/portal${path.startsWith("/") ? path : `/${path}`}`, { ...init, allowEmpty: true });

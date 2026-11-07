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

export async function patientPortalRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/nguoi-kham/portal${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as PortalEnvelope<T> | null;
  if (!response.ok || !payload || payload.success === false) {
    throw new Error(payload?.message || "Không thể tải dữ liệu. Vui lòng thử lại.");
  }
  return { data: payload.data as T, meta: payload.meta };
}


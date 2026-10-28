const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api";

export const AUTH_EXPIRED_EVENT = "hospital-dashboard:auth-expired";
const DASHBOARD_REQUEST_HEADER = "X-Hospital-Dashboard-Request";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  suppressAuthExpired?: boolean;
  skipAuthRefresh?: boolean;
};

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const notifyAuthExpired = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
};

const isDashboardRoute = () =>
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/dashboard");

let refreshPromise: Promise<boolean> | null = null;

const refreshDashboardSession = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(buildUrl("/auth/dashboard/refresh"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      [DASHBOARD_REQUEST_HEADER]: "1",
    },
  })
    .then(async (response) => {
      const payload = (await response
        .json()
        .catch(() => null)) as ApiEnvelope<unknown> | null;
      return response.ok && payload?.success !== false;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
) {
  const {
    body,
    query,
    headers,
    suppressAuthExpired,
    skipAuthRefresh,
    ...init
  } = options;

  const response = await fetch(buildUrl(path, query), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...((init.method || "GET").toUpperCase() !== "GET"
        ? { [DASHBOARD_REQUEST_HEADER]: "1" }
        : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || payload?.success === false) {
    if (
      response.status === 401 &&
      isDashboardRoute() &&
      !skipAuthRefresh &&
      path !== "/auth/dashboard/refresh"
    ) {
      const refreshed = await refreshDashboardSession();

      if (refreshed) {
        return apiRequest<T>(path, {
          ...options,
          skipAuthRefresh: true,
        });
      }
    }

    if (response.status === 401 && !suppressAuthExpired && isDashboardRoute()) {
      notifyAuthExpired();
    }

    throw new ApiError(
      payload?.message || "Không thể kết nối tới máy chủ",
      response.status,
    );
  }

  return payload?.data as T;
}

export async function uploadImages(files: File[], folder: string) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("images", file);
  });
  formData.append("folder", folder);

  const response = await fetch(buildUrl("/uploads/images"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      [DASHBOARD_REQUEST_HEADER]: "1",
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    items: import("@/lib/types").MediaAsset[];
  }> | null;

  if (!response.ok || payload?.success === false) {
    if (response.status === 401 && isDashboardRoute()) {
      notifyAuthExpired();
    }

    throw new ApiError(
      payload?.message || "Không upload được ảnh",
      response.status,
    );
  }

  return payload?.data?.items || [];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api/v1";

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

// Địa chỉ đầy đủ của API, dùng cho liên kết mở trong tab mới (cookie đăng nhập đi kèm).
export const apiUrl = (path: string) => buildUrl(path);

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

// Tệp kết quả khám (PDF hoặc ảnh JPG, PNG, WEBP, tối đa 10 MB). Chỉ tài khoản có quyền ghi bệnh án
// (bác sĩ) tải được; tệp được lưu riêng tư và bệnh nhân chỉ xem qua cổng của mình.
export async function uploadMedicalFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(buildUrl("/uploads/medical-files"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      [DASHBOARD_REQUEST_HEADER]: "1",
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    item: import("@/lib/types").MediaAsset;
  }> | null;

  if (!response.ok || payload?.success === false) {
    if (response.status === 401 && isDashboardRoute()) {
      notifyAuthExpired();
    }

    throw new ApiError(
      payload?.message || "Không tải được tệp kết quả",
      response.status,
    );
  }

  if (!payload?.data?.item) {
    throw new ApiError("Đã tải lên nhưng không nhận được đường dẫn tệp", response.status);
  }
  return payload.data.item;
}

// Tải một báo cáo CSV từ backend (cookie dashboard đi kèm) rồi lưu thành tệp trên máy.
export async function downloadCsv(
  path: string,
  query: Record<string, string | undefined>,
  fallbackName: string,
) {
  const response = await fetch(buildUrl(path, query), {
    credentials: "include",
    headers: { Accept: "text/csv", [DASHBOARD_REQUEST_HEADER]: "1" },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (response.status === 401 && isDashboardRoute()) {
      notifyAuthExpired();
    }
    throw new ApiError(payload?.message || "Không xuất được báo cáo", response.status);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const fileName = disposition.match(/filename="?([^";]+)/i)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

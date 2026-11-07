const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");

const SERVER_API_TIMEOUT_MS = 12000;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type ServerApiOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>;
  next?: NextFetchRequestConfig;
};

export async function serverApiRequest<T>(
  path: string,
  options: ServerApiOptions = {},
): Promise<T> {
  const url = new URL(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );

  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  // API chạy trên gói free có thể đang "ngủ" hoặc tạm thời sập. Không đặt giới
  // hạn thì fetch treo quá 60 giây và làm hỏng bước dựng trang tĩnh khi build.
  // Hết hạn sẽ ném lỗi để các nơi gọi dùng giá trị dự phòng.
  const response = await fetch(url.toString(), {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(SERVER_API_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    next: options.next || { revalidate: 300 },
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | T
    | null;
  const envelope = payload as ApiEnvelope<T> | null;

  if (!response.ok || !payload || envelope?.success === false) {
    throw new Error(envelope?.message || "Không tải được dữ liệu");
  }

  if (envelope && "data" in envelope) {
    return envelope.data as T;
  }

  return payload as T;
}

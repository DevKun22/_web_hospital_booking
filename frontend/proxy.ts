import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");

type DoctorEnvelope = {
  data?: {
    slug?: string;
  };
};

// Chỉ phục vụ tương thích ngược cho URL hồ sơ bác sĩ dùng UUID trước đây.
// Các route công khai mới luôn liên kết trực tiếp đến /bac-si/<slug>.
export async function proxy(request: NextRequest) {
  const identifier = request.nextUrl.pathname.split("/").filter(Boolean)[1];
  if (!identifier) return NextResponse.next();

  let slug = identifier;

  try {
    const response = await fetch(
      `${API_BASE_URL}/doctors/${encodeURIComponent(identifier)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );

    if (response.ok) {
      const payload = (await response.json()) as DoctorEnvelope;
      slug = payload.data?.slug || identifier;
    }
  } catch {
    // Vẫn chuyển sang route mới; trang đích sẽ tự trả 404 nếu bác sĩ không tồn tại.
  }

  return NextResponse.redirect(
    new URL(`/bac-si/${encodeURIComponent(slug)}`, request.url),
    308,
  );
}

export const config = {
  matcher: "/doctors/:id",
};

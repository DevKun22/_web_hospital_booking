import { serverApiRequest } from "@/lib/server-api";
import {
  emptySnapshot,
  toPublicHomeData,
  type PublicBootstrap,
  type PublicBootstrapSnapshot,
  type PublicBootstrapView,
} from "@/lib/public-bootstrap";

// Lấy dữ liệu công khai trên máy chủ. Lỗi không làm hỏng trang: trả về dữ liệu rỗng kèm thông báo,
// trình duyệt sẽ tự tải lại.
export async function loadPublicBootstrap(view: PublicBootstrapView, revalidate: number): Promise<PublicBootstrapSnapshot> {
  try {
    const bootstrap = await serverApiRequest<PublicBootstrap>("/public/bootstrap", {
      query: { view },
      next: { revalidate },
    });
    return { data: toPublicHomeData(bootstrap), fetchedAt: Date.now(), error: "" };
  } catch (error) {
    return emptySnapshot(error instanceof Error ? error.message : "Không tải được dữ liệu website");
  }
}

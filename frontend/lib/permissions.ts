import type { DashboardUser } from "@/lib/types";

// Quyền do backend quyết định (ma trận rbac.matrix) và trả về ở /auth/dashboard/me.
// Giao diện chỉ dùng để ẩn/hiện; backend vẫn là nơi chặn thật.
export function can(
  user: Pick<DashboardUser, "permissions"> | null | undefined,
  ...codes: string[]
) {
  const granted = user?.permissions;
  return Boolean(granted && codes.some((code) => granted.includes(code)));
}

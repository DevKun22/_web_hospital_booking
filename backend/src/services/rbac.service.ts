import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import {
  PERMISSIONS,
  PERMISSION_CODES,
  isPermissionCode,
  isStaffRole,
  normalizeGrants,
  permissionsForRole,
  type PermissionCode,
  type PermissionGrants,
  type StaffRole,
} from "../config/permissions.js";
import { AppError } from "../utils/appError.js";

export const RBAC_MATRIX_KEY = "rbac.matrix";
const CACHE_TTL_MS = 15_000;

let cache: { grants: PermissionGrants; expiresAt: number } | null = null;

export const invalidateRbacCache = () => {
  cache = null;
};

// Nhiều instance chỉ đồng bộ sau tối đa CACHE_TTL_MS; instance vừa ghi thì có hiệu lực ngay.
export const loadGrants = async (): Promise<PermissionGrants> => {
  if (cache && cache.expiresAt > Date.now()) return cache.grants;

  const setting = await prisma.siteSetting.findUnique({
    where: { key: RBAC_MATRIX_KEY },
    select: { value: true, isActive: true },
  });
  const stored =
    setting?.isActive && setting.value && typeof setting.value === "object"
      ? (setting.value as { grants?: unknown }).grants
      : undefined;

  const grants = normalizeGrants(stored);
  cache = { grants, expiresAt: Date.now() + CACHE_TTL_MS };
  return grants;
};

export const roleHasAnyPermission = async (
  role: string | undefined,
  codes: readonly PermissionCode[],
) => {
  if (!role || !isStaffRole(role)) return false;
  const grants = await loadGrants();
  return codes.some((code) => grants[code].includes(role));
};

export const getRolePermissions = async (role: string) =>
  permissionsForRole(await loadGrants(), role);

class RbacService {
  async getMatrix() {
    const grants = await loadGrants();
    return {
      roles: ["ADMIN", "STAFF", "DOCTOR", "PHARMACIST"] as StaffRole[],
      permissions: PERMISSION_CODES.map((code) => ({
        code,
        group: PERMISSIONS[code].group,
        label: PERMISSIONS[code].label,
        eligibleRoles: [...PERMISSIONS[code].eligibleRoles],
        fixedRoles: [...PERMISSIONS[code].fixedRoles],
        roles: grants[code],
      })),
    };
  }

  // Nhận { [code]: Role[] }. Mã lạ hoặc vai trò ngoài `eligibleRoles` bị từ chối
  // thay vì lặng lẽ bỏ qua, để người dùng biết thay đổi không có hiệu lực.
  async updateMatrix(input: Record<string, string[]>, actorId: string) {
    for (const [code, roles] of Object.entries(input)) {
      if (!isPermissionCode(code)) {
        throw new AppError(`Mã quyền không tồn tại: ${code}`, 400, "RBAC_UNKNOWN_PERMISSION");
      }
      const eligible: readonly string[] = PERMISSIONS[code].eligibleRoles;
      const invalid = roles.filter((role) => !eligible.includes(role));
      if (invalid.length > 0) {
        throw new AppError(
          `Quyền ${code} không thể cấp cho: ${invalid.join(", ")}`,
          400,
          "RBAC_ROLE_NOT_ELIGIBLE",
        );
      }
    }

    const current = await loadGrants();
    const next = normalizeGrants({ ...current, ...input });
    const value = {
      version: 1,
      grants: next,
      updatedById: actorId,
      updatedAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;

    await prisma.siteSetting.upsert({
      where: { key: RBAC_MATRIX_KEY },
      create: { key: RBAC_MATRIX_KEY, value, description: "Ma trận phân quyền động" },
      update: { value, isActive: true },
    });
    invalidateRbacCache();
    return this.getMatrix();
  }

  async resetMatrix() {
    await prisma.siteSetting.deleteMany({ where: { key: RBAC_MATRIX_KEY } });
    invalidateRbacCache();
    return this.getMatrix();
  }
}

export default new RbacService();

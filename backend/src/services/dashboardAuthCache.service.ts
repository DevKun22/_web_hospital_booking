import type { Role } from "../../generated/prisma/enums.js";

type DashboardAuthSnapshot = {
  id: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
};

type CachedSnapshot = DashboardAuthSnapshot & {
  expiresAt: number;
};

const cache = new Map<string, CachedSnapshot>();
const readTtlMs = () => {
  const configured = Number(process.env.DASHBOARD_AUTH_CACHE_TTL_MS || 30_000);

  return Number.isFinite(configured) && configured >= 0 ? configured : 30_000;
};

export const getCachedDashboardAuthSnapshot = (userId: string) => {
  const cached = cache.get(userId);

  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(userId);
    return null;
  }

  return {
    id: cached.id,
    role: cached.role,
    isActive: cached.isActive,
    mustChangePassword: cached.mustChangePassword,
  };
};

export const cacheDashboardAuthSnapshot = (snapshot: DashboardAuthSnapshot) => {
  const ttlMs = readTtlMs();

  if (ttlMs === 0) return;

  cache.set(snapshot.id, {
    ...snapshot,
    expiresAt: Date.now() + ttlMs,
  });
};

export const invalidateDashboardAuthSnapshot = (userId: string) => {
  cache.delete(userId);
};

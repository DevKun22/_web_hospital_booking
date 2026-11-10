import { prisma } from "../config/prisma.js";
import {
  getReadinessCacheMs,
  getReadinessTimeoutMs,
} from "../config/environment.js";

type ReadinessProbe = () => Promise<void>;

type ReadinessOptions = {
  probe?: ReadinessProbe;
  timeoutMs?: number;
  cacheMs?: number;
  now?: () => number;
};

const probeDatabase: ReadinessProbe = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

const runWithTimeout = async (probe: ReadinessProbe, timeoutMs: number) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      probe().then(() => true, () => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const createReadinessCheck = (options: ReadinessOptions = {}) => {
  const probe = options.probe ?? probeDatabase;
  const timeoutMs = options.timeoutMs ?? getReadinessTimeoutMs();
  const cacheMs = options.cacheMs ?? getReadinessCacheMs();
  const now = options.now ?? Date.now;
  let cached: { ready: boolean; expiresAt: number } | null = null;
  let inFlight: Promise<boolean> | null = null;

  return async () => {
    const current = now();
    if (cached && cached.expiresAt > current) return cached.ready;
    if (inFlight) return inFlight;

    inFlight = runWithTimeout(probe, timeoutMs)
      .then((ready) => {
        cached = { ready, expiresAt: now() + cacheMs };
        return ready;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
};

export const checkReadiness = createReadinessCheck();

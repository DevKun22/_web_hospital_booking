import { prisma } from "../config/prisma.js";
import {
  getReadinessCacheMs,
  getReadinessTimeoutMs,
  isProductionLike,
} from "../config/environment.js";
import {
  hasCacheRedisUrl,
  hasQueueRedisUrl,
  isRedisRequiredForReadiness,
  resolveCacheRedisUrl,
  resolveQueueRedisUrl,
} from "../config/redis.js";
import {
  getCacheRedisClient,
  getQueueRedisProbeClient,
} from "./cacheRedis.service.js";
import {
  reportRedisAvailable,
  reportRedisUnavailable,
} from "./redisHealth.service.js";

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

export type RedisReadinessStatus = "up" | "down" | "not_configured";

export type ReadinessReport = {
  ready: boolean;
  status: "ready" | "degraded" | "not_ready";
  checks: {
    database: "up" | "down";
    redis: RedisReadinessStatus;
    queueRedis: RedisReadinessStatus;
  };
};

type SystemReadinessOptions = {
  databaseCheck?: () => Promise<boolean>;
  redisCheck?: () => Promise<RedisReadinessStatus>;
  queueRedisCheck?: () => Promise<RedisReadinessStatus>;
  redisRequired?: boolean;
  production?: boolean;
  cacheMs?: number;
  now?: () => number;
  sharedRedis?: boolean;
};

const probeClient = async (
  client: ReturnType<typeof getCacheRedisClient>,
  component: "cache" | "queue",
  source: string,
): Promise<RedisReadinessStatus> => {
  if (!client) return "not_configured";
  const available = await runWithTimeout(
    async () => {
      await client.ping();
    },
    getReadinessTimeoutMs(),
  );
  if (available) {
    reportRedisAvailable(component, source);
    return "up";
  }
  reportRedisUnavailable(
    component,
    source,
    new Error("Redis ping failed or timed out"),
  );
  return "down";
};

const probeRedis = async (): Promise<RedisReadinessStatus> =>
  hasCacheRedisUrl()
    ? probeClient(getCacheRedisClient(), "cache", "readiness")
    : "not_configured";

const probeQueueRedis = async (): Promise<RedisReadinessStatus> =>
  hasQueueRedisUrl()
    ? probeClient(getQueueRedisProbeClient(), "queue", "readiness")
    : "not_configured";

export const createSystemReadinessCheck = (
  options: SystemReadinessOptions = {},
) => {
  const databaseCheck = options.databaseCheck ?? createReadinessCheck();
  const redisCheck = options.redisCheck ?? probeRedis;
  const queueRedisCheck = options.queueRedisCheck ?? probeQueueRedis;
  const redisRequired =
    options.redisRequired ?? isRedisRequiredForReadiness();
  const production = options.production ?? isProductionLike();
  const cacheMs = options.cacheMs ?? getReadinessCacheMs();
  const now = options.now ?? Date.now;
  const sharedRedis =
    options.sharedRedis ??
    (!options.redisCheck &&
      !options.queueRedisCheck &&
      hasCacheRedisUrl() &&
      resolveCacheRedisUrl() === resolveQueueRedisUrl());
  let cached: { report: ReadinessReport; expiresAt: number } | null = null;
  let inFlight: Promise<ReadinessReport> | null = null;

  return async () => {
    const current = now();
    if (cached && cached.expiresAt > current) return cached.report;
    if (inFlight) return inFlight;

    inFlight = (async (): Promise<ReadinessReport> => {
      const redisPromise = redisCheck();
      const [databaseReady, redis, queueRedis] = await Promise.all([
        databaseCheck(),
        redisPromise,
        sharedRedis ? redisPromise : queueRedisCheck(),
      ]);
      const redisUnavailable = [redis, queueRedis].some(
        (status) => status === "down" || status === "not_configured",
      );
      const ready = databaseReady && (!redisRequired || !redisUnavailable);
      const degraded =
        ready &&
        ([redis, queueRedis].includes("down") ||
          (production && [redis, queueRedis].includes("not_configured")));

      return {
        ready,
        status: ready ? (degraded ? "degraded" : "ready") : "not_ready",
        checks: {
          database: databaseReady ? "up" : "down",
          redis,
          queueRedis,
        },
      };
    })()
      .then((report) => {
        cached = { report, expiresAt: now() + cacheMs };
        return report;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
};

export const checkReadiness = createSystemReadinessCheck();

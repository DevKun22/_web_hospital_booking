import type { Request, RequestHandler } from "express";
import { Redis } from "ioredis";

import { isRateLimitEnabled } from "../config/environment.js";
import { getRedisConnectionOptions, hasRedisUrl } from "../queues/redis.js";
import { AppError } from "../utils/appError.js";

// Giới hạn tần suất theo cửa sổ cố định. Đếm bằng Redis khi có (dùng chung giữa
// các tiến trình), nếu không có hoặc Redis lỗi thì đếm trong bộ nhớ tiến trình.
// Lỗi hạ tầng không bao giờ chặn người dùng thật: limiter luôn "mở" khi lỗi.

export type RateLimitHit = { count: number; resetAt: number };

export type RateLimitStore = {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
};

const MAX_MEMORY_BUCKETS = 100_000;
const MEMORY_SWEEP_INTERVAL_MS = 60_000;

export const createMemoryRateLimitStore = (
  now: () => number = Date.now,
): RateLimitStore => {
  const buckets = new Map<string, RateLimitHit>();
  let lastSweepAt = now();

  return {
    async hit(key, windowMs) {
      const current = now();

      if (
        current - lastSweepAt >= MEMORY_SWEEP_INTERVAL_MS ||
        buckets.size > MAX_MEMORY_BUCKETS
      ) {
        for (const [bucketKey, bucket] of buckets) {
          if (bucket.resetAt <= current) buckets.delete(bucketKey);
        }
        if (buckets.size > MAX_MEMORY_BUCKETS) buckets.clear();
        lastSweepAt = current;
      }

      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= current) {
        const fresh = { count: 1, resetAt: current + windowMs };
        buckets.set(key, fresh);
        return { ...fresh };
      }

      bucket.count += 1;
      return { ...bucket };
    },
  };
};

type RedisLike = Pick<Redis, "multi" | "pexpire">;

export const createRedisRateLimitStore = (
  client: RedisLike,
  now: () => number = Date.now,
): RateLimitStore => ({
  async hit(key, windowMs) {
    const results = await client.multi().incr(key).pttl(key).exec();
    if (!results || results.length !== 2) {
      throw new Error("Unexpected Redis response for rate limit");
    }

    const [[incrError, count], [ttlError, ttl]] = results as [
      [Error | null, number],
      [Error | null, number],
    ];
    if (incrError || ttlError) throw incrError || ttlError;

    // Khóa mới, hoặc khóa mất TTL (tiến trình chết giữa INCR và PEXPIRE): đặt lại
    // hạn để không bao giờ chặn vĩnh viễn.
    let remainingMs = ttl;
    if (count === 1 || ttl < 0) {
      await client.pexpire(key, windowMs);
      remainingMs = windowMs;
    }

    return { count, resetAt: now() + remainingMs };
  },
});

const WARN_INTERVAL_MS = 60_000;
let lastWarnAt = 0;
const warnStoreFailure = (error: unknown) => {
  const current = Date.now();
  if (current - lastWarnAt < WARN_INTERVAL_MS) return;
  lastWarnAt = current;
  console.warn(
    `[RATE_LIMIT] Redis unavailable, using in-memory counters: ${
      error instanceof Error ? error.message : "unknown error"
    }`,
  );
};

export const createFallbackRateLimitStore = (
  primary: RateLimitStore,
  fallback: RateLimitStore,
): RateLimitStore => ({
  async hit(key, windowMs) {
    try {
      return await primary.hit(key, windowMs);
    } catch (error) {
      warnStoreFailure(error);
      return fallback.hit(key, windowMs);
    }
  },
});

let defaultStore: RateLimitStore | null = null;

const getDefaultStore = (): RateLimitStore => {
  if (defaultStore) return defaultStore;

  const memory = createMemoryRateLimitStore();
  if (!hasRedisUrl()) {
    defaultStore = memory;
    return defaultStore;
  }

  const client = new Redis({
    ...getRedisConnectionOptions(),
    // Hỏng thì báo lỗi ngay để chuyển sang bộ nhớ, không xếp hàng chờ.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  client.on("error", warnStoreFailure);

  defaultStore = createFallbackRateLimitStore(
    createRedisRateLimitStore(client),
    memory,
  );
  return defaultStore;
};

export type RateLimitOptions = {
  // Tên chính sách, dùng làm tiền tố khóa đếm.
  name: string;
  windowMs: number;
  max: number;
  // Trả null/rỗng để bỏ qua giới hạn cho request này.
  key: (req: Request) => string | null | undefined;
  message?: string;
  store?: RateLimitStore;
  enabled?: () => boolean;
  now?: () => number;
};

export const RATE_LIMIT_CODE = "RATE_LIMITED";
const DEFAULT_MESSAGE = "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";

export const rateLimit = (options: RateLimitOptions): RequestHandler => {
  const now = options.now ?? Date.now;
  const enabled = options.enabled ?? isRateLimitEnabled;

  return async (req, res, next) => {
    if (!enabled()) return next();

    const identity = options.key(req);
    if (!identity) return next();

    try {
      const store = options.store ?? getDefaultStore();
      const hit = await store.hit(
        `rl:${options.name}:${identity}`,
        options.windowMs,
      );

      if (hit.count > options.max) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((hit.resetAt - now()) / 1000),
        );
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return next(
          new AppError(options.message || DEFAULT_MESSAGE, 429, RATE_LIMIT_CODE),
        );
      }
    } catch (error) {
      warnStoreFailure(error);
    }

    return next();
  };
};

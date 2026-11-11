const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

const isEnabled = (value?: string) =>
  TRUE_VALUES.has((value || "").trim().toLowerCase());

export const resolveCacheRedisUrl = (env: NodeJS.ProcessEnv = process.env) =>
  env.REDIS_URL?.trim() || "";

export const resolveQueueRedisUrl = (env: NodeJS.ProcessEnv = process.env) =>
  env.QUEUE_REDIS_URL?.trim() || resolveCacheRedisUrl(env);

export const hasCacheRedisUrl = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(resolveCacheRedisUrl(env));

export const hasQueueRedisUrl = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(resolveQueueRedisUrl(env));

const parseRedisUrl = (value: string, name: "REDIS_URL" | "QUEUE_REDIS_URL") => {
  if (!value) throw new Error(`${name} is missing`);
  if (value.startsWith("http://") || value.startsWith("https://")) {
    throw new Error(`${name} must be a Redis TCP URL, not an HTTP REST URL`);
  }
  if (!value.startsWith("redis://") && !value.startsWith("rediss://")) {
    throw new Error(`${name} must start with redis:// or rediss://`);
  }
  return new URL(value);
};

const toConnectionOptions = (
  redisUrl: URL,
  overrides: Record<string, unknown> = {},
) => {
  const db = redisUrl.pathname ? Number(redisUrl.pathname.slice(1)) : 0;
  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username
      ? decodeURIComponent(redisUrl.username)
      : undefined,
    password: redisUrl.password
      ? decodeURIComponent(redisUrl.password)
      : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: redisUrl.protocol === "rediss:" ? {} : undefined,
    ...overrides,
  };
};

export const getCacheRedisConnectionOptions = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  toConnectionOptions(parseRedisUrl(resolveCacheRedisUrl(env), "REDIS_URL"), {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

export const getQueueRedisConnectionOptions = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  toConnectionOptions(
    parseRedisUrl(resolveQueueRedisUrl(env), "QUEUE_REDIS_URL"),
    {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
  );

export const getRedisSecurityWarnings = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const warnings: string[] = [];
  const cacheValue = resolveCacheRedisUrl(env);
  const queueValue = env.QUEUE_REDIS_URL?.trim() || "";
  const privateNetwork = isEnabled(env.REDIS_PRIVATE_NETWORK);

  const parsed = ([
    ["REDIS_URL", cacheValue],
    ["QUEUE_REDIS_URL", queueValue],
  ] as const).flatMap(([name, value]) => {
    if (!value) return [];
    const url = parseRedisUrl(value, name);
    if (url.protocol !== "rediss:" && !privateNetwork) {
      warnings.push(
        `${name} must use rediss:// unless REDIS_PRIVATE_NETWORK=true`,
      );
    }
    const username = decodeURIComponent(url.username || "");
    if (!username || !url.password) {
      warnings.push(`${name} must include a Redis ACL username and password`);
    }
    return [{ name, url, username }];
  });

  const cache = parsed.find((item) => item.name === "REDIS_URL");
  const queue = parsed.find((item) => item.name === "QUEUE_REDIS_URL");
  if (!cacheValue) {
    warnings.push("REDIS_URL is not configured; API Redis features run degraded");
  }
  if (!queueValue && cacheValue) {
    warnings.push(
      "QUEUE_REDIS_URL is not configured; BullMQ shares REDIS_URL credentials",
    );
  }
  if (
    cache &&
    queue &&
    cache.url.hostname === queue.url.hostname &&
    (cache.url.port || "6379") === (queue.url.port || "6379") &&
    cache.username === queue.username
  ) {
    warnings.push("REDIS_URL and QUEUE_REDIS_URL must use separate ACL users");
  }

  return warnings;
};

export const validateProductionRedis = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const mode = (env.REDIS_SECURITY_MODE || "strict").trim().toLowerCase();
  if (mode !== "warn" && mode !== "strict") {
    throw new Error("REDIS_SECURITY_MODE must be warn or strict");
  }
  if (mode === "warn") {
    throw new Error("REDIS_SECURITY_MODE=warn is not allowed in production");
  }
  const warnings = getRedisSecurityWarnings(env);
  if (warnings.length === 0) return;
  throw new Error(
    `Unsafe Redis production configuration: ${warnings.join("; ")}`,
  );
};

export const isRedisRequiredForReadiness = (
  env: NodeJS.ProcessEnv = process.env,
) => isEnabled(env.REDIS_REQUIRED_FOR_READINESS);

import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/readiness_test";

const { createReadinessCheck, createSystemReadinessCheck } = await import(
  "../../src/services/readiness.service.js"
);

test("readiness caches results and coalesces concurrent probes", async () => {
  let current = 1_000;
  let probes = 0;
  let releaseProbe: (() => void) | undefined;
  const check = createReadinessCheck({
    now: () => current,
    cacheMs: 500,
    timeoutMs: 1_000,
    probe: () =>
      new Promise<void>((resolve) => {
        probes += 1;
        releaseProbe = resolve;
      }),
  });

  const first = check();
  const concurrent = check();
  assert.equal(probes, 1);
  releaseProbe?.();
  assert.equal(await first, true);
  assert.equal(await concurrent, true);
  assert.equal(await check(), true);
  assert.equal(probes, 1);

  current += 501;
  const refreshed = check();
  assert.equal(probes, 2);
  releaseProbe?.();
  assert.equal(await refreshed, true);
});

test("readiness returns false for probe failures and timeouts", async () => {
  const failed = createReadinessCheck({
    cacheMs: 1,
    timeoutMs: 50,
    probe: async () => {
      throw new Error("database unavailable");
    },
  });
  assert.equal(await failed(), false);

  const timedOut = createReadinessCheck({
    cacheMs: 1,
    timeoutMs: 5,
    probe: () => new Promise<void>(() => undefined),
  });
  assert.equal(await timedOut(), false);
});

test("system readiness reports Redis degradation without hiding database health", async () => {
  const degraded = createSystemReadinessCheck({
    databaseCheck: async () => true,
    redisCheck: async () => "down",
    queueRedisCheck: async () => "up",
    redisRequired: false,
    production: true,
  });
  assert.deepEqual(await degraded(), {
    ready: true,
    status: "degraded",
    checks: { database: "up", redis: "down", queueRedis: "up" },
  });

  const required = createSystemReadinessCheck({
    databaseCheck: async () => true,
    redisCheck: async () => "down",
    queueRedisCheck: async () => "up",
    redisRequired: true,
    production: true,
  });
  assert.deepEqual(await required(), {
    ready: false,
    status: "not_ready",
    checks: { database: "up", redis: "down", queueRedis: "up" },
  });

  const databaseDown = createSystemReadinessCheck({
    databaseCheck: async () => false,
    redisCheck: async () => "up",
    queueRedisCheck: async () => "up",
    production: true,
  });
  assert.equal((await databaseDown()).status, "not_ready");
});

test("system readiness coalesces shared Redis probes and caches the report", async () => {
  let current = 1_000;
  let databaseProbes = 0;
  let redisProbes = 0;
  let queueProbes = 0;
  const check = createSystemReadinessCheck({
    databaseCheck: async () => {
      databaseProbes += 1;
      return true;
    },
    redisCheck: async () => {
      redisProbes += 1;
      return "up";
    },
    queueRedisCheck: async () => {
      queueProbes += 1;
      return "up";
    },
    sharedRedis: true,
    cacheMs: 500,
    now: () => current,
  });

  await Promise.all([check(), check()]);
  await check();
  assert.equal(databaseProbes, 1);
  assert.equal(redisProbes, 1);
  assert.equal(queueProbes, 0);

  current += 501;
  await check();
  assert.equal(databaseProbes, 2);
  assert.equal(redisProbes, 2);
});

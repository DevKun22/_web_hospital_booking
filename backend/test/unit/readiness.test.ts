import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/readiness_test";

const { createReadinessCheck } = await import(
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

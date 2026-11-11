import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??=
  "postgresql://metrics:metrics@127.0.0.1:5432/metrics_test";

const { collectRuntimeMetrics } = await import(
  "../../src/observability/runtimeMetrics.js"
);

test("runtime metrics report memory, DB pool, requests and queues without secrets", async () => {
  const metrics = await collectRuntimeMetrics("test-worker", {
    memoryUsage: () => ({
      rss: 100 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 25 * 1024 * 1024,
      external: 5 * 1024 * 1024,
      arrayBuffers: 0,
    }),
    databasePool: () => ({ max: 10, total: 6, idle: 2, waiting: 1 }),
    requestMetrics: () => ({
      requests: 4,
      errors: 1,
      slowRequests: 2,
      durationMs: 200,
      databaseQueries: 12,
      databaseDurationMs: 80,
    }),
    queueMetrics: async () => ({
      status: "up" as const,
      queues: [
        {
          name: "otp-delivery",
          waiting: 3,
          active: 1,
          delayed: 2,
          failed: 0,
        },
      ],
    }),
  });

  assert.equal(metrics.role, "test-worker");
  assert.deepEqual(metrics.memoryMiB, {
    rss: 100,
    heapUsed: 25,
    heapTotal: 50,
    external: 5,
  });
  assert.equal(metrics.databasePool.utilization, 0.4);
  assert.equal(metrics.requests.averageDurationMs, 50);
  assert.equal(metrics.requests.averageDatabaseDurationMs, 20);
  assert.equal(metrics.queue.queues[0]?.waiting, 3);
  assert.doesNotMatch(JSON.stringify(metrics), /postgresql|password|secret/i);
});

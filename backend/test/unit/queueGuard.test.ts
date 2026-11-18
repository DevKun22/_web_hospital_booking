import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  guardedEnqueue,
  isQuotaError,
  isQueueCoolingDown,
  QueueEnqueueTimeoutError,
  resetQueueGuard,
} from "../../src/queues/queueGuard.js";

beforeEach(() => resetQueueGuard());

const clock = (start = 1_000_000) => {
  let current = start;
  return { now: () => current, advance: (ms: number) => void (current += ms) };
};

test("a healthy queue returns the enqueue result and never cools down", async () => {
  const time = clock();
  const result = await guardedEnqueue(async () => "job-1", { timeoutMs: 50, now: time.now });
  assert.equal(result, "job-1");
  assert.equal(isQueueCoolingDown(time.now), false);
});

test("a rejected enqueue is rethrown and short-circuits the next calls without touching Redis", async () => {
  const time = clock();
  await assert.rejects(
    guardedEnqueue(async () => Promise.reject(new Error("connection refused")), { timeoutMs: 50, now: time.now }),
    /connection refused/,
  );
  assert.equal(isQueueCoolingDown(time.now), true);

  let called = false;
  const skipped = await guardedEnqueue(
    async () => {
      called = true;
      return "never";
    },
    { timeoutMs: 50, now: time.now },
  );
  assert.equal(skipped, false);
  assert.equal(called, false, "đang ngắt mạch thì không được gọi Redis");

  time.advance(31_000);
  assert.equal(await guardedEnqueue(async () => "back", { timeoutMs: 50, now: time.now }), "back");
});

test("an enqueue that hangs is cut off by the timeout instead of hanging the request", async () => {
  const time = clock();
  const started = Date.now();
  await assert.rejects(
    guardedEnqueue(() => new Promise<string>(() => undefined), { timeoutMs: 30, now: time.now }),
    (error) => error instanceof QueueEnqueueTimeoutError,
  );
  assert.ok(Date.now() - started < 1_000);
  assert.equal(isQueueCoolingDown(time.now), true);
});

test("a late rejection after the timeout does not become an unhandled rejection", async () => {
  const time = clock();
  let rejectLate: (error: Error) => void = () => undefined;
  const slow = new Promise<string>((_, reject) => {
    rejectLate = reject;
  });
  await assert.rejects(guardedEnqueue(() => slow, { timeoutMs: 20, now: time.now }), QueueEnqueueTimeoutError);

  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", listener);
  rejectLate(new Error("late failure"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  process.off("unhandledRejection", listener);
  assert.deepEqual(unhandled, []);
});

test("a quota error cools down far longer than a transient failure", async () => {
  const time = clock();
  assert.equal(isQuotaError(new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500000")), true);
  assert.equal(isQuotaError(new Error("connection refused")), false);

  await assert.rejects(
    guardedEnqueue(async () => Promise.reject(new Error("ERR max requests limit exceeded")), {
      timeoutMs: 50,
      now: time.now,
    }),
  );
  time.advance(5 * 60_000);
  assert.equal(isQueueCoolingDown(time.now), true, "5 phút sau vẫn còn ngắt mạch khi hết hạn mức");
  time.advance(6 * 60_000);
  assert.equal(isQueueCoolingDown(time.now), false);
});

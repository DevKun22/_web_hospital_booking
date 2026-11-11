import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response } from "express";
import type { RateLimitStore } from "../../src/middlewares/rateLimit.middleware.js";

const {
  createFallbackRateLimitStore,
  createMemoryRateLimitStore,
  createRedisRateLimitStore,
  rateLimit,
} = await import("../../src/middlewares/rateLimit.middleware.js");
const { AppError } = await import("../../src/utils/appError.js");

const fakeClock = (start = 1_000_000) => {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
};

// Runs the middleware once and reports whether it passed or rejected.
const run = async (
  handler: ReturnType<typeof rateLimit>,
  ip = "1.1.1.1",
) => {
  const headers: Record<string, string> = {};
  const req = { ip } as unknown as Request;
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response;

  let error: unknown;
  await handler(req, res, (value?: unknown) => {
    error = value;
  });
  return { error, headers };
};

const limiter = (
  clock: ReturnType<typeof fakeClock>,
  overrides: Partial<Parameters<typeof rateLimit>[0]> = {},
) =>
  rateLimit({
    name: "test",
    windowMs: 60_000,
    max: 3,
    key: (req) => req.ip,
    store: createMemoryRateLimitStore(clock.now),
    enabled: () => true,
    now: clock.now,
    ...overrides,
  });

test("requests pass up to the limit and the next one is rejected with 429", async () => {
  const clock = fakeClock();
  const handler = limiter(clock);

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await run(handler)).error, undefined);
  }

  const blocked = await run(handler);
  assert.ok(blocked.error instanceof AppError);
  assert.equal(blocked.error.statusCode, 429);
  assert.equal(blocked.error.code, "RATE_LIMITED");
  assert.equal(blocked.headers["Retry-After"], "60");
});

test("Retry-After counts down the remaining window", async () => {
  const clock = fakeClock();
  const handler = limiter(clock, { max: 1 });

  await run(handler);
  clock.advance(45_000);
  const blocked = await run(handler);
  assert.equal(blocked.headers["Retry-After"], "15");
});

test("the counter resets after the window and keys are independent", async () => {
  const clock = fakeClock();
  const handler = limiter(clock, { max: 1 });

  assert.equal((await run(handler, "1.1.1.1")).error, undefined);
  assert.ok((await run(handler, "1.1.1.1")).error instanceof AppError);
  assert.equal((await run(handler, "2.2.2.2")).error, undefined);

  clock.advance(60_001);
  assert.equal((await run(handler, "1.1.1.1")).error, undefined);
});

test("a disabled limiter or an empty key never blocks", async () => {
  const clock = fakeClock();
  const disabled = limiter(clock, { max: 0, enabled: () => false });
  assert.equal((await run(disabled)).error, undefined);

  const noKey = limiter(clock, { max: 0, key: () => null });
  assert.equal((await run(noKey)).error, undefined);
});

test("a failing store fails open instead of blocking real users", async () => {
  const clock = fakeClock();
  const handler = limiter(clock, {
    max: 0,
    store: {
      hit: async () => {
        throw new Error("redis down");
      },
    },
  });

  assert.equal((await run(handler)).error, undefined);
});

test("a sensitive endpoint fails closed when every rate-limit store fails", async () => {
  const clock = fakeClock();
  const handler = limiter(clock, {
    store: {
      hit: async () => {
        throw new Error("all counters unavailable");
      },
    },
    failureMode: "deny",
  });

  const blocked = await run(handler);
  assert.ok(blocked.error instanceof AppError);
  assert.equal(blocked.error.statusCode, 503);
  assert.equal(blocked.error.code, "RATE_LIMIT_UNAVAILABLE");
  assert.equal(blocked.headers["Retry-After"], "60");
});

test("the fallback store switches to memory counters when the primary fails", async () => {
  const clock = fakeClock();
  const store = createFallbackRateLimitStore(
    {
      hit: async () => {
        throw new Error("redis down");
      },
    },
    createMemoryRateLimitStore(clock.now),
  );

  const first = await store.hit("k", 60_000);
  const second = await store.hit("k", 60_000);
  assert.equal(first.count, 1);
  assert.equal(first.degraded, true);
  assert.equal(second.count, 2);
  assert.equal(second.degraded, true);
});

test("degraded policies tighten sensitive endpoints and keep low-risk reads available", async () => {
  const clock = fakeClock();
  const degradedStore: RateLimitStore = {
    hit: async () => ({ count: 2, resetAt: clock.now() + 60_000, degraded: true }),
  };
  const strict = limiter(clock, {
    max: 10,
    store: degradedStore,
    degraded: { mode: "enforce", max: 1 },
  });
  const available = limiter(clock, {
    max: 1,
    store: degradedStore,
    degraded: { mode: "allow" },
  });
  const healthy = limiter(clock, {
    max: 2,
    store: {
      hit: async () => ({ count: 2, resetAt: clock.now() + 60_000 }),
    },
    degraded: { mode: "enforce", max: 1 },
  });

  assert.ok((await run(strict)).error instanceof AppError);
  assert.equal((await run(available)).error, undefined);
  assert.equal((await run(healthy)).error, undefined);
});

test("the Redis store sets a TTL on a new key and repairs a key without TTL", async () => {
  const expires: Array<[string, number]> = [];
  let reply: Array<[null, number]> = [
    [null, 1],
    [null, -1],
  ];
  const store = createRedisRateLimitStore(
    {
      multi: () => ({
        incr: () => ({
          pttl: () => ({ exec: async () => reply }),
        }),
      }),
      pexpire: async (key: string, ms: number) => {
        expires.push([key, ms]);
        return 1;
      },
    } as never,
    () => 5_000,
  );

  const first = await store.hit("k", 60_000);
  assert.equal(first.count, 1);
  assert.equal(first.resetAt, 65_000);
  assert.deepEqual(expires, [["k", 60_000]]);

  // A later hit within the window keeps the existing TTL.
  reply = [
    [null, 2],
    [null, 20_000],
  ];
  const second = await store.hit("k", 60_000);
  assert.equal(second.count, 2);
  assert.equal(second.resetAt, 25_000);
  assert.equal(expires.length, 1);

  // Count above 1 but TTL lost (process died between INCR and PEXPIRE).
  reply = [
    [null, 9],
    [null, -1],
  ];
  await store.hit("k", 60_000);
  assert.equal(expires.length, 2);
});

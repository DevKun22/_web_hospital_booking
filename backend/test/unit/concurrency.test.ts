import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  ConcurrencySemaphore,
  mapWithConcurrency,
} from "../../src/utils/concurrency.js";
import { createConcurrencyLimit } from "../../src/middlewares/resourceConcurrency.middleware.js";

test("semaphore load-sheds at its limit and releases permits once", () => {
  const semaphore = new ConcurrencySemaphore(2);
  const releaseFirst = semaphore.tryAcquire();
  const releaseSecond = semaphore.tryAcquire();

  assert.ok(releaseFirst);
  assert.ok(releaseSecond);
  assert.equal(semaphore.activeCount, 2);
  assert.equal(semaphore.tryAcquire(), null);

  releaseFirst();
  releaseFirst();
  assert.equal(semaphore.activeCount, 1);
  assert.ok(semaphore.tryAcquire());
});

test("bounded mapper caps active work and preserves input order", async () => {
  let active = 0;
  let peak = 0;
  const release: Array<() => void> = [];

  const resultPromise = mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => release.push(resolve));
    active -= 1;
    return value * 10;
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  release.shift()?.();
  release.shift()?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  release.shift()?.();
  release.shift()?.();

  assert.deepEqual(await resultPromise, [10, 20, 30, 40]);
  assert.equal(peak, 2);
});

test("HTTP concurrency limit rejects excess work and reopens after response", () => {
  const middleware = createConcurrencyLimit({ limit: 1, message: "busy" });
  const createResponse = () => {
    const response = new EventEmitter() as EventEmitter &
      Pick<Response, "once" | "setHeader">;
    response.setHeader = () => response as Response;
    return response as Response;
  };
  const request = {} as Request;
  const firstResponse = createResponse();
  let firstError: unknown;

  middleware(request, firstResponse, ((error?: unknown) => {
    firstError = error;
  }) as NextFunction);
  assert.equal(firstError, undefined);

  const secondResponse = createResponse();
  let secondError: unknown;
  middleware(request, secondResponse, ((error?: unknown) => {
    secondError = error;
  }) as NextFunction);
  assert.deepEqual(
    {
      statusCode: (secondError as { statusCode?: number }).statusCode,
      code: (secondError as { code?: string }).code,
    },
    { statusCode: 503, code: "RESOURCE_BUSY" },
  );

  firstResponse.emit("finish");
  let thirdError: unknown;
  middleware(request, createResponse(), ((error?: unknown) => {
    thirdError = error;
  }) as NextFunction);
  assert.equal(thirdError, undefined);
});

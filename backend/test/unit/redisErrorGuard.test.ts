import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  handleProcessLevelError,
  isRedisOriginatedError,
  resetRedisErrorGuardForTests,
} from "../../src/observability/redisErrorGuard.js";

beforeEach(() => resetRedisErrorGuardForTests());

const redisError = (message: string, name = "Error") => {
  const error = new Error(message);
  error.name = name;
  return error;
};

test("errors that come from the Redis client libraries are recognised", () => {
  assert.equal(isRedisOriginatedError(redisError("ERR max requests limit exceeded. Limit: 500000", "ReplyError")), true);
  assert.equal(isRedisOriginatedError(redisError("Connection is closed.")), true);
  assert.equal(isRedisOriginatedError(redisError("boom", "MaxRetriesPerRequestError")), true);

  const stacked = new Error("anything");
  stacked.stack = "Error: anything\n    at x (/opt/render/project/src/backend/node_modules/bullmq/dist/cjs/classes/worker.js:1:1)";
  assert.equal(isRedisOriginatedError(stacked), true);
});

test("ordinary application errors and non-errors are not treated as Redis errors", () => {
  assert.equal(isRedisOriginatedError(new Error("Cannot read properties of undefined")), false);
  assert.equal(isRedisOriginatedError(new TypeError("x is not a function")), false);
  assert.equal(isRedisOriginatedError("a string"), false);
  assert.equal(isRedisOriginatedError(undefined), false);
});

test("a Redis error is ignored and the process keeps running, a real bug still exits", () => {
  const exits: number[] = [];
  const exit = (code: number) => exits.push(code);

  assert.equal(handleProcessLevelError("uncaughtException", redisError("Connection is closed."), { exit }), "ignored");
  assert.equal(handleProcessLevelError("unhandledRejection", redisError("x", "ReplyError"), { exit }), "ignored");
  assert.deepEqual(exits, []);

  assert.equal(handleProcessLevelError("uncaughtException", new TypeError("real bug"), { exit }), "fatal");
  assert.deepEqual(exits, [1]);
});

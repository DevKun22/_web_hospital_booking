import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { startHttpServer } from "../support/http.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://phase0:phase0@127.0.0.1:5432/hospital_booking_test";
process.env.REDIS_URL = "";
process.env.JWT_SECRET = "phase0_test_jwt_secret_at_least_32_chars";
process.env.OTP_SECRET = "phase0_test_otp_secret_at_least_32_chars";
process.env.LOOKUP_GRANT_SECRET =
  "phase0_test_lookup_secret_at_least_32_chars";

const { createApp } = await import("../../src/app.js");
const { validateRuntimeEnvironment } = await import(
  "../../src/config/environment.js"
);

let http: Awaited<ReturnType<typeof startHttpServer>>;

before(async () => {
  http = await startHttpServer(
    createApp({ requestLogging: false, slowRequestLogging: false }),
  );
});

after(async () => {
  await http.close();
});

test("health routes can be imported without opening the production port", async () => {
  const root = await http.request("/");
  const health = await http.request("/health");

  assert.equal(root.status, 200);
  assert.equal(root.body.status, "Medical Booking API Running...");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.headers.get("x-powered-by"), null);
  assert.match(health.headers.get("x-request-id") || "", /^[0-9a-f-]{36}$/);
});

test("unknown routes preserve the legacy error envelope", async () => {
  const response = await http.request("/api/phase-0-not-found");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "ROUTE_NOT_FOUND");
  assert.equal(response.body.message, "Route /api/phase-0-not-found not found");
  assert.equal(typeof response.body.requestId, "string");
  assert.deepEqual(response.body.errors, []);
});

test("request validation preserves success, message and errors", async () => {
  for (const path of ["/api/appointments", "/api/v1/appointments"]) {
    const response = await http.request(path, {
      method: "POST",
      body: {},
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, "VALIDATION_ERROR");
    assert.equal(typeof response.body.requestId, "string");
    assert.equal(response.body.message, "Dữ liệu không hợp lệ");
    assert.ok(Array.isArray(response.body.errors));
    assert.ok(response.body.errors.length > 0);
  }
});

test("production startup rejects missing, weak or debug OTP secrets", () => {
  assert.throws(
    () => validateRuntimeEnvironment({ NODE_ENV: "production" }),
    /JWT_SECRET is required/,
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        NODE_ENV: "production",
        JWT_SECRET: "short",
        OTP_SECRET: "also-short",
      }),
    /JWT_SECRET must contain at least 32 characters/,
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        NODE_ENV: "production",
        JWT_SECRET: "j".repeat(32),
        OTP_SECRET: "o".repeat(32),
        LOOKUP_GRANT_SECRET: "l".repeat(32),
        OTP_DEBUG_ENABLED: "true",
      }),
    /OTP_DEBUG_ENABLED must be disabled/,
  );
  assert.doesNotThrow(() =>
    validateRuntimeEnvironment({
      NODE_ENV: "production",
      JWT_SECRET: "j".repeat(32),
      OTP_SECRET: "o".repeat(32),
      LOOKUP_GRANT_SECRET: "l".repeat(32),
      OTP_DEBUG_ENABLED: "false",
    }),
  );
});

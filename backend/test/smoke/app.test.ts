import assert from "node:assert/strict";
import crypto from "node:crypto";
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
const {
  getAppointmentReminderLeadMinutes,
  getDatabaseTransactionMaxWaitMs,
  getDatabaseTransactionTimeoutMs,
  getSlowRequestThresholdMs,
  isDatabaseQueryMetricsEnabled,
  isPerformanceHeadersEnabled,
  getNotificationDispatchBatchSize,
  getNotificationMaxDeliveryAttempts,
  getNotificationWorkerIntervalMs,
  shouldLogWorkerNoop,
  validateNotificationWorkerEnvironment,
  validateRuntimeEnvironment,
} = await import("../../src/config/environment.js");
const {
  getRequestPerformanceSnapshot,
  getSafeRequestPath,
  recordDatabaseQuery,
  runWithRequestPerformance,
} = await import("../../src/observability/requestPerformance.js");
const { resolveQueueRedisUrl } = await import("../../src/queues/redis.js");
const {
  defaultNotificationPushPreferences,
  isNotificationPushEnabled,
  notificationPreferenceKeyForType,
} = await import("../../src/services/notificationPreference.service.js");
const {
  getMomoConfigurationStatus,
  getPaymentProviderCapabilities,
  parseVerifiedMomoCallback,
} = await import("../../src/services/paymentProviders/index.js");
const { assertSafeTestDatabase, buildIntegrationEnvironment } = await import(
  "../support/testDatabase.js"
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

test("local performance headers can be enabled without exposing database metrics", async () => {
  const performanceHttp = await startHttpServer(
    createApp({
      requestLogging: false,
      slowRequestLogging: true,
      performanceHeaders: true,
      queryMetricsEnabled: false,
      slowRequestThresholdMs: 60_000,
    }),
  );

  try {
    const response = await performanceHttp.request("/health");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("server-timing") || "", /^app;dur=\d/);
    assert.equal(response.headers.get("x-database-query-count"), null);
  } finally {
    await performanceHttp.close();
  }
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
      PAYMENT_MOCK_ENABLED: "false",
      DATABASE_URL: "postgresql://production.example.test/hospital",
      FRONTEND_URLS: "https://hospital.example.test",
    }),
  );
});

test("production startup rejects unsafe data and browser configuration", () => {
  const validProduction = {
    NODE_ENV: "production",
    JWT_SECRET: "j".repeat(32),
    OTP_SECRET: "o".repeat(32),
    LOOKUP_GRANT_SECRET: "l".repeat(32),
    OTP_DEBUG_ENABLED: "false",
    PAYMENT_MOCK_ENABLED: "false",
    DATABASE_URL: "postgresql://production.example.test/hospital",
    FRONTEND_URLS: "https://hospital.example.test",
  };

  assert.throws(
    () =>
      validateRuntimeEnvironment({
        ...validProduction,
        PAYMENT_MOCK_ENABLED: "true",
      }),
    /PAYMENT_MOCK_ENABLED must be disabled/,
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        ...validProduction,
        TEST_DATABASE_URL: validProduction.DATABASE_URL,
      }),
    /TEST_DATABASE_URL must not equal DATABASE_URL/,
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        ...validProduction,
        FRONTEND_URLS: "http:\/\/hospital.example.test",
      }),
    /must be HTTPS origins/,
  );
});

test("production startup requires complete HTTPS MoMo configuration when enabled", () => {
  const validProduction = {
    NODE_ENV: "production",
    JWT_SECRET: "j".repeat(32),
    OTP_SECRET: "o".repeat(32),
    LOOKUP_GRANT_SECRET: "l".repeat(32),
    DATABASE_URL: "postgresql://production.example.test/hospital",
    FRONTEND_URLS: "https://hospital.example.test",
    PAYMENT_MOCK_ENABLED: "false",
    PAYMENT_MOMO_ENABLED: "true",
  };

  assert.throws(
    () => validateRuntimeEnvironment(validProduction),
    /MOMO_PARTNER_CODE is required/,
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        ...validProduction,
        MOMO_PARTNER_CODE: "partner",
        MOMO_ACCESS_KEY: "access",
        MOMO_SECRET_KEY: "secret",
        MOMO_REDIRECT_URL: "http://hospital.example.test/payment-return",
        MOMO_IPN_URL: "https://api.example.test/api/payments/momo/webhook",
      }),
    /MOMO_REDIRECT_URL must be a valid HTTPS URL/,
  );
  assert.doesNotThrow(() =>
    validateRuntimeEnvironment({
      ...validProduction,
      MOMO_PARTNER_CODE: "partner",
      MOMO_ACCESS_KEY: "access",
      MOMO_SECRET_KEY: "secret",
      MOMO_REDIRECT_URL: "https://hospital.example.test/payment-return",
      MOMO_IPN_URL: "https://api.example.test/api/payments/momo/webhook",
    }),
  );
});

test("MoMo capability needs both feature flag and complete credentials", () => {
  assert.deepEqual(getMomoConfigurationStatus({}), {
    enabled: false,
    configured: false,
    missing: [
      "MOMO_PARTNER_CODE",
      "MOMO_ACCESS_KEY",
      "MOMO_SECRET_KEY",
      "MOMO_REDIRECT_URL",
      "MOMO_IPN_URL",
    ],
  });

  const previous = { ...process.env };
  try {
    process.env.PAYMENT_MOMO_ENABLED = "true";
    process.env.MOMO_PARTNER_CODE = "partner";
    process.env.MOMO_ACCESS_KEY = "access";
    process.env.MOMO_SECRET_KEY = "secret";
    process.env.MOMO_REDIRECT_URL = "https://hospital.example.test/return";
    process.env.MOMO_IPN_URL =
      "https://api.example.test/api/payments/momo/webhook";
    assert.ok(
      getPaymentProviderCapabilities().providers.some(
        (item) => item.provider === "MOMO",
      ),
    );
  } finally {
    process.env = previous;
  }
});

test("MoMo callback rejects tampering and parses a valid signed payload", () => {
  const previousAccessKey = process.env.MOMO_ACCESS_KEY;
  const previousSecretKey = process.env.MOMO_SECRET_KEY;
  process.env.MOMO_ACCESS_KEY = "sandbox-access";
  process.env.MOMO_SECRET_KEY = "sandbox-secret";
  try {
    const payload: Record<string, unknown> = {
      partnerCode: "sandbox-partner",
      orderId: "PAYMENT-001",
      requestId: "PAYMENT-001",
      amount: 250000,
      orderInfo: "Thanh toán hóa đơn HD-001",
      orderType: "momo_wallet",
      transId: 123456789,
      resultCode: 0,
      message: "Successful.",
      payType: "qr",
      responseTime: 1721720619912,
      extraData: "",
    };
    const raw = [
      "accessKey=sandbox-access",
      "amount=250000",
      "extraData=",
      "message=Successful.",
      "orderId=PAYMENT-001",
      "orderInfo=Thanh toán hóa đơn HD-001",
      "orderType=momo_wallet",
      "partnerCode=sandbox-partner",
      "payType=qr",
      "requestId=PAYMENT-001",
      "responseTime=1721720619912",
      "resultCode=0",
      "transId=123456789",
    ].join("&");
    payload.signature = crypto
      .createHmac("sha256", "sandbox-secret")
      .update(raw)
      .digest("hex");

    const verified = parseVerifiedMomoCallback(payload);
    assert.equal(verified.orderId, "PAYMENT-001");
    assert.equal(verified.amount, 250000);
    assert.equal(verified.resultCode, 0);

    assert.throws(
      () => parseVerifiedMomoCallback({ ...payload, amount: 250001 }),
      /Chữ ký callback MoMo không hợp lệ/,
    );
  } finally {
    if (previousAccessKey === undefined) delete process.env.MOMO_ACCESS_KEY;
    else process.env.MOMO_ACCESS_KEY = previousAccessKey;
    if (previousSecretKey === undefined) delete process.env.MOMO_SECRET_KEY;
    else process.env.MOMO_SECRET_KEY = previousSecretKey;
  }
});

test("production notification worker requires one Firebase credential", () => {
  const validProduction = {
    NODE_ENV: "production",
    JWT_SECRET: "j".repeat(32),
    OTP_SECRET: "o".repeat(32),
    LOOKUP_GRANT_SECRET: "l".repeat(32),
    DATABASE_URL: "postgresql://production.example.test/hospital",
    FRONTEND_URLS: "https://hospital.example.test",
    FIREBASE_PROJECT_ID: "hospital-production",
  };

  assert.throws(
    () => validateNotificationWorkerEnvironment(validProduction),
    /Firebase Admin credential is required/,
  );
  assert.doesNotThrow(() =>
    validateNotificationWorkerEnvironment({
      ...validProduction,
      FIREBASE_SERVICE_ACCOUNT_BASE64: "encoded-secret",
    }),
  );
  assert.throws(
    () =>
      validateNotificationWorkerEnvironment({
        ...validProduction,
        FIREBASE_SERVICE_ACCOUNT_BASE64: "encoded-secret",
        GOOGLE_APPLICATION_CREDENTIALS: "C:\\secrets\\firebase.json",
      }),
    /only one Firebase Admin credential method/,
  );
});

test("notification delivery attempts use a safe positive limit", () => {
  assert.equal(getNotificationMaxDeliveryAttempts({}), 8);
  assert.equal(
    getNotificationMaxDeliveryAttempts({
      NOTIFICATION_MAX_DELIVERY_ATTEMPTS: "3",
    }),
    3,
  );
  assert.equal(
    getNotificationMaxDeliveryAttempts({
      NOTIFICATION_MAX_DELIVERY_ATTEMPTS: "0",
    }),
    8,
  );
});

test("database transaction limits stay bounded for remote development databases", () => {
  assert.equal(getDatabaseTransactionTimeoutMs({}), 15_000);
  assert.equal(getDatabaseTransactionMaxWaitMs({}), 5_000);
  assert.equal(
    getDatabaseTransactionTimeoutMs({ DATABASE_TRANSACTION_TIMEOUT_MS: "0" }),
    15_000,
  );
  assert.equal(
    getDatabaseTransactionTimeoutMs({ DATABASE_TRANSACTION_TIMEOUT_MS: "60000" }),
    30_000,
  );
  assert.equal(
    getDatabaseTransactionMaxWaitMs({ DATABASE_TRANSACTION_MAX_WAIT_MS: "60000" }),
    15_000,
  );
});

test("performance settings are opt-in and bounded", () => {
  assert.equal(getSlowRequestThresholdMs({}), 500);
  assert.equal(getSlowRequestThresholdMs({ SLOW_REQUEST_THRESHOLD_MS: "0" }), 500);
  assert.equal(
    getSlowRequestThresholdMs({ SLOW_REQUEST_THRESHOLD_MS: "999999" }),
    60_000,
  );
  assert.equal(isDatabaseQueryMetricsEnabled({}), false);
  assert.equal(
    isDatabaseQueryMetricsEnabled({ DATABASE_QUERY_METRICS_ENABLED: "true" }),
    true,
  );
  assert.equal(isPerformanceHeadersEnabled({}), false);
  assert.equal(
    isPerformanceHeadersEnabled({ PERFORMANCE_HEADERS_ENABLED: "1" }),
    true,
  );
});

test("performance telemetry does not expose query values or path identifiers", () => {
  assert.equal(
    getSafeRequestPath(
      "/api/v1/me/appointments/8a66f807-7f47-42b2-8332-98ca89d81377?phone=0912345678",
    ),
    "/api/v1/me/appointments/:id",
  );
  assert.equal(
    getSafeRequestPath("/api/appointments/HB-8492?keyword=dau%20bung"),
    "/api/appointments/:id",
  );

  runWithRequestPerformance("request-test", () => {
    recordDatabaseQuery(12.5);
    recordDatabaseQuery(7.5);
    const snapshot = getRequestPerformanceSnapshot();

    assert.equal(snapshot?.requestId, "request-test");
    assert.equal(snapshot?.databaseQueryCount, 2);
    assert.equal(snapshot?.databaseDurationMs, 20);
  });
});

test("notification worker settings reject unsafe interval and batch values", () => {
  assert.equal(getNotificationWorkerIntervalMs({}), 30_000);
  assert.equal(
    getNotificationWorkerIntervalMs({ NOTIFICATION_WORKER_INTERVAL_MS: "abc" }),
    30_000,
  );
  assert.equal(
    getNotificationWorkerIntervalMs({ NOTIFICATION_WORKER_INTERVAL_MS: "100" }),
    5_000,
  );
  assert.equal(getNotificationDispatchBatchSize({}), 100);
  assert.equal(
    getNotificationDispatchBatchSize({ NOTIFICATION_DISPATCH_BATCH_SIZE: "0" }),
    100,
  );
  assert.equal(
    getNotificationDispatchBatchSize({ NOTIFICATION_DISPATCH_BATCH_SIZE: "1000" }),
    500,
  );
});

test("appointment reminder lead time uses a safe positive default", () => {
  assert.equal(getAppointmentReminderLeadMinutes({}), 120);
  assert.equal(
    getAppointmentReminderLeadMinutes({
      APPOINTMENT_REMINDER_LEAD_MINUTES: "1440",
    }),
    1440,
  );
  assert.equal(
    getAppointmentReminderLeadMinutes({
      APPOINTMENT_REMINDER_LEAD_MINUTES: "0",
    }),
    120,
  );
});

test("notification preference categories only control push delivery", () => {
  assert.equal(
    notificationPreferenceKeyForType("APPOINTMENT_REMINDER"),
    "appointmentRemindersPush",
  );
  assert.equal(
    notificationPreferenceKeyForType("MEDICAL_RESULT_PUBLISHED"),
    "medicalResultsPush",
  );
  assert.equal(
    notificationPreferenceKeyForType("PRESCRIPTION_ISSUED"),
    "prescriptionsPush",
  );
  assert.equal(
    notificationPreferenceKeyForType("PAYMENT_REFUNDED"),
    "billingPush",
  );
  assert.equal(
    notificationPreferenceKeyForType("APPOINTMENT_CANCELLED"),
    "appointmentUpdatesPush",
  );
  assert.equal(
    isNotificationPushEnabled(
      "APPOINTMENT_REMINDER",
      {
        ...defaultNotificationPushPreferences,
        appointmentRemindersPush: false,
      },
    ),
    false,
  );
  assert.equal(
    isNotificationPushEnabled("APPOINTMENT_REMINDER", null),
    true,
  );
});

test("queue Redis prefers its dedicated connection and keeps the legacy fallback", () => {
  assert.equal(
    resolveQueueRedisUrl({
      QUEUE_REDIS_URL: "rediss://queue.example.test:6380",
      REDIS_URL: "rediss://legacy.example.test:6380",
    }),
    "rediss://queue.example.test:6380",
  );
  assert.equal(
    resolveQueueRedisUrl({ REDIS_URL: "redis://127.0.0.1:6379" }),
    "redis://127.0.0.1:6379",
  );
});

test("worker no-op logs stay opt-in", () => {
  assert.equal(shouldLogWorkerNoop({}), false);
  assert.equal(shouldLogWorkerNoop({ WORKER_LOG_NOOP: "true" }), true);
});

test("integration safety rejects an unmarked database without an override", () => {
  const previousTestUrl = process.env.TEST_DATABASE_URL;
  const previousLegacyOverride = process.env.TEST_DATABASE_DESTRUCTIVE_OK;

  try {
    process.env.TEST_DATABASE_URL =
      "postgresql://phase0:phase0@127.0.0.1:5432/postgres";
    process.env.TEST_DATABASE_DESTRUCTIVE_OK =
      "I_UNDERSTAND_TEST_DATA_WILL_BE_DELETED";

    assert.throws(
      () => assertSafeTestDatabase(),
      /There is no override for an unmarked database/,
    );
  } finally {
    if (previousTestUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestUrl;

    if (previousLegacyOverride === undefined) {
      delete process.env.TEST_DATABASE_DESTRUCTIVE_OK;
    } else {
      process.env.TEST_DATABASE_DESTRUCTIVE_OK = previousLegacyOverride;
    }
  }
});

test("integration safety accepts and forwards an isolated test schema", () => {
  const previousTestUrl = process.env.TEST_DATABASE_URL;

  try {
    const isolatedUrl =
      "postgresql://phase0:phase0@127.0.0.1:5432/postgres?schema=hospital_booking_test";
    process.env.TEST_DATABASE_URL = isolatedUrl;

    assert.equal(assertSafeTestDatabase(), isolatedUrl);
    assert.equal(buildIntegrationEnvironment().DATABASE_URL, isolatedUrl);
  } finally {
    if (previousTestUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestUrl;
  }
});

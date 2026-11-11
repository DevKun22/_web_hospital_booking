import { validateProductionRedis } from "./redis.js";

const MIN_SECRET_LENGTH = 32;
const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const MAX_TRUST_PROXY_HOPS = 10;
const PRODUCTION_INLINE_WORKERS = [
  "otp",
  "appointments",
  "notifications",
  "payments",
] as const;

const isEnabled = (value?: string) =>
  TRUE_VALUES.has((value || "").trim().toLowerCase());

export const isProductionLike = (env: NodeJS.ProcessEnv = process.env) =>
  env.NODE_ENV === "production" || isEnabled(env.RENDER);

// Giới hạn tần suất mặc định bật, trừ môi trường test (test tích hợp gọi API
// hàng loạt từ một IP). Đặt RATE_LIMIT_ENABLED=true/false để ghi đè.
export const isRateLimitEnabled = (env: NodeJS.ProcessEnv = process.env) => {
  const configured = env.RATE_LIMIT_ENABLED?.trim();
  if (configured) return isEnabled(configured);
  return env.NODE_ENV !== "test";
};

const assertStrongSecret = (
  env: NodeJS.ProcessEnv,
  name: "JWT_SECRET" | "OTP_SECRET",
) => {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required in production.`);
  }

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must contain at least ${MIN_SECRET_LENGTH} characters in production.`,
    );
  }
};

const requireProductionValue = (
  env: NodeJS.ProcessEnv,
  name: "DATABASE_URL" | "FRONTEND_URLS" | "FIREBASE_PROJECT_ID",
) => {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in production.`);
  }
  return value;
};

const validateProductionFrontendOrigins = (env: NodeJS.ProcessEnv) => {
  const configured =
    env.FRONTEND_URLS?.trim() || env.FRONTEND_URL?.trim() || "";
  if (!configured) {
    throw new Error("FRONTEND_URLS is required in production.");
  }

  for (const origin of configured.split(",").map((item) => item.trim())) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid production frontend origin: ${origin}`);
    }
    if (parsed.protocol !== "https:" || parsed.origin !== origin) {
      throw new Error(
        `Production frontend origins must be HTTPS origins without paths: ${origin}`,
      );
    }
  }
};

const parseTrustProxyHops = (value?: string) => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_TRUST_PROXY_HOPS
    ? parsed
    : null;
};

const validateTrustProxyHops = (env: NodeJS.ProcessEnv) => {
  if (
    env.TRUST_PROXY_HOPS?.trim() &&
    parseTrustProxyHops(env.TRUST_PROXY_HOPS) === null
  ) {
    throw new Error(
      `TRUST_PROXY_HOPS must be an integer from 0 to ${MAX_TRUST_PROXY_HOPS}.`,
    );
  }
};

const validateProductionVnpay = (env: NodeJS.ProcessEnv) => {
  if (!isEnabled(env.PAYMENT_VNPAY_ENABLED)) return;
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL"] as const) {
    if (!env[name]?.trim()) {
      throw new Error(`${name} is required when VNPAY payment is enabled.`);
    }
  }
  if (!env.VNPAY_RETURN_URL!.trim().startsWith("https://")) {
    throw new Error("VNPAY_RETURN_URL must be a valid HTTPS URL.");
  }
};

export const validateRuntimeEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  if (!isProductionLike(env)) return;

  assertStrongSecret(env, "JWT_SECRET");
  assertStrongSecret(env, "OTP_SECRET");

  if (isEnabled(env.OTP_DEBUG_ENABLED)) {
    throw new Error("OTP_DEBUG_ENABLED must be disabled in production.");
  }

  const databaseUrl = requireProductionValue(env, "DATABASE_URL");
  if (env.TEST_DATABASE_URL?.trim() === databaseUrl) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL.");
  }

  validateProductionFrontendOrigins(env);
  validateTrustProxyHops(env);
  validateProductionVnpay(env);
  validateProductionRedis(env);
  validateDatabasePoolBudget(env);
  validateProductionWorkerTopology(env);
  if (env.DEMO_OTP_PHONES?.trim()) {
    throw new Error("DEMO_OTP_PHONES must not be configured in production.");
  }

  if (
    env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim() &&
    env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  ) {
    throw new Error(
      "Configure only one Firebase Admin credential method in production.",
    );
  }
};

export const validateNotificationWorkerEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  validateRuntimeEnvironment(env);
  if (!isProductionLike(env)) return;

  if (
    !env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim() &&
    !env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  ) {
    throw new Error(
      "A Firebase Admin credential is required for the production notification worker.",
    );
  }
  requireProductionValue(env, "FIREBASE_PROJECT_ID");
};

export const resolveOtpSecret = (env: NodeJS.ProcessEnv = process.env) => {
  const secret =
    env.OTP_SECRET?.trim() ||
    (!isProductionLike(env) ? env.JWT_SECRET?.trim() || "dev_otp_secret" : "");

  if (!secret) {
    throw new Error("OTP_SECRET is required in production.");
  }

  return secret;
};

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const boundedPositiveInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) => Math.min(Math.max(positiveInteger(value, fallback), minimum), maximum);

const boundedNonNegativeInteger = (
  value: string | undefined,
  fallback: number,
  maximum: number,
) => {
  const parsed = Number(value);
  const resolved =
    Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
  return Math.min(resolved, maximum);
};

export const getDatabaseApiReplicaCount = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.DATABASE_API_REPLICA_COUNT, 1, 1, 100);

export const getDatabaseWorkerReplicaCount = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedNonNegativeInteger(env.DATABASE_WORKER_REPLICA_COUNT, 0, 100);

export const getDatabaseTotalConnectionBudget = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.DATABASE_TOTAL_CONNECTION_BUDGET,
    15,
    2,
    1_000,
  );

export const getDatabaseConnectionReserve = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const budget = getDatabaseTotalConnectionBudget(env);
  return Math.min(
    boundedNonNegativeInteger(env.DATABASE_CONNECTION_RESERVE, 3, 100),
    budget - 1,
  );
};

export const getDatabasePoolSize = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const configured = Number(env.DATABASE_POOL_SIZE);
  if (Number.isSafeInteger(configured) && configured > 0) {
    return Math.min(configured, 100);
  }

  const processCount =
    getDatabaseApiReplicaCount(env) + getDatabaseWorkerReplicaCount(env);
  const usableConnections =
    getDatabaseTotalConnectionBudget(env) - getDatabaseConnectionReserve(env);
  return Math.max(
    1,
    Math.min(Math.floor(usableConnections / processCount), 10),
  );
};

export const getDatabasePoolConnectionTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    5_000,
    1_000,
    30_000,
  );

export const getDatabasePoolIdleTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    30_000,
    5_000,
    300_000,
  );

export const getDatabasePoolBudget = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const apiReplicas = getDatabaseApiReplicaCount(env);
  const workerReplicas = getDatabaseWorkerReplicaCount(env);
  const poolSize = getDatabasePoolSize(env);
  const reserve = getDatabaseConnectionReserve(env);
  const totalBudget = getDatabaseTotalConnectionBudget(env);
  return {
    apiReplicas,
    workerReplicas,
    processCount: apiReplicas + workerReplicas,
    poolSize,
    reserve,
    totalBudget,
    plannedConnections:
      poolSize * (apiReplicas + workerReplicas) + reserve,
  };
};

export const validateDatabasePoolBudget = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const budget = getDatabasePoolBudget(env);
  if (budget.plannedConnections > budget.totalBudget) {
    throw new Error(
      `Database pool plan needs ${budget.plannedConnections} connections but ` +
        `DATABASE_TOTAL_CONNECTION_BUDGET is ${budget.totalBudget}.`,
    );
  }
  return budget;
};

export const isRuntimeMetricsEnabled = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  if (env.RUNTIME_METRICS_ENABLED?.trim()) {
    return isEnabled(env.RUNTIME_METRICS_ENABLED);
  }
  return isProductionLike(env);
};

export const getRuntimeMetricsIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.RUNTIME_METRICS_INTERVAL_MS,
    60_000,
    15_000,
    15 * 60_000,
  );

export const validateProductionWorkerTopology = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  if (!isProductionLike(env)) return;
  const configured = new Set(
    (env.INLINE_WORKERS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const expected = new Set<string>(PRODUCTION_INLINE_WORKERS);
  const missing = [...expected].filter((name) => !configured.has(name));
  const extra = [...configured].filter((name) => !expected.has(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      "Production worker topology requires exactly " +
        `INLINE_WORKERS=${PRODUCTION_INLINE_WORKERS.join(",")}.`,
    );
  }
};

export const getDatabaseTransactionTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.DATABASE_TRANSACTION_TIMEOUT_MS, 15_000), 30_000);

export const getDatabaseTransactionMaxWaitMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.DATABASE_TRANSACTION_MAX_WAIT_MS, 5_000), 15_000);

export const getReadinessTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.READINESS_TIMEOUT_MS, 2_000), 5_000);

export const getReadinessCacheMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.READINESS_CACHE_MS, 5_000), 30_000);

// Render đặt đúng một reverse proxy trước web service. Local/test không có
// proxy nên mặc định không tin X-Forwarded-For do client tự gửi.
export const getTrustProxySetting = (
  env: NodeJS.ProcessEnv = process.env,
): number | false => {
  const configured = parseTrustProxyHops(env.TRUST_PROXY_HOPS);
  if (configured !== null) return configured || false;
  return isProductionLike(env) ? 1 : false;
};

export const getHttpRequestTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.HTTP_REQUEST_TIMEOUT_MS,
    120_000,
    10_000,
    300_000,
  );

export const getHttpHeadersTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.HTTP_HEADERS_TIMEOUT_MS, 30_000, 5_000, 60_000);

export const getHttpKeepAliveTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.HTTP_KEEP_ALIVE_TIMEOUT_MS,
    5_000,
    1_000,
    30_000,
  );

export const getHttpMaxRequestsPerSocket = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  boundedPositiveInteger(
    env.HTTP_MAX_REQUESTS_PER_SOCKET,
    1_000,
    100,
    10_000,
  );

export const getSlowRequestThresholdMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.SLOW_REQUEST_THRESHOLD_MS, 500), 60_000);

export const isDatabaseQueryMetricsEnabled = (
  env: NodeJS.ProcessEnv = process.env,
) => isEnabled(env.DATABASE_QUERY_METRICS_ENABLED);

export const isPerformanceHeadersEnabled = (
  env: NodeJS.ProcessEnv = process.env,
) => isEnabled(env.PERFORMANCE_HEADERS_ENABLED);

export const getBookingHoldMinutes = (env: NodeJS.ProcessEnv = process.env) =>
  positiveInteger(env.BOOKING_HOLD_MINUTES, 10);

export const getAppointmentReconciliationIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.APPOINTMENT_RECONCILIATION_INTERVAL_MS, 5 * 60_000);

export const getAppointmentReconciliationBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.APPOINTMENT_RECONCILIATION_BATCH_SIZE, 100);

export const getReconciliationConcurrency = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.RECONCILIATION_CONCURRENCY, 4, 1, 16);

export const getSlotReconciliationIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.SLOT_RECONCILIATION_INTERVAL_MS, 15 * 60_000);

export const getSlotReconciliationBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.SLOT_RECONCILIATION_BATCH_SIZE, 200);

export const getNotificationMaxDeliveryAttempts = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.NOTIFICATION_MAX_DELIVERY_ATTEMPTS, 8);

export const getNotificationWorkerIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  Math.max(
    positiveInteger(env.NOTIFICATION_WORKER_INTERVAL_MS, 2 * 60_000),
    5_000,
  );

export const getNotificationDispatchBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.NOTIFICATION_DISPATCH_BATCH_SIZE, 100), 500);

export const getOutboxDispatchBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.OUTBOX_DISPATCH_BATCH_SIZE, 50, 1, 200);

export const getOutboxDispatchConcurrency = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.OUTBOX_DISPATCH_CONCURRENCY, 4, 1, 16);

export const getOutboxMaxAttempts = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.OUTBOX_MAX_ATTEMPTS, 8, 1, 20);

export const getOutboxLeaseMs = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.OUTBOX_LEASE_MS, 60_000, 10_000, 10 * 60_000);

export const getOutboxRetentionDays = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.OUTBOX_RETENTION_DAYS, 30, 1, 365);

export const getNotificationDispatchConcurrency = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.NOTIFICATION_DISPATCH_CONCURRENCY, 4, 1, 32);

export const getReminderDispatchConcurrency = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.REMINDER_DISPATCH_CONCURRENCY, 4, 1, 16);

export const getMedicalFileUploadConcurrency = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.MEDICAL_FILE_UPLOAD_CONCURRENCY, 2, 1, 16);

export const getMedicalFileDownloadConcurrency = (
  env: NodeJS.ProcessEnv = process.env,
) => boundedPositiveInteger(env.MEDICAL_FILE_DOWNLOAD_CONCURRENCY, 8, 1, 64);

export const getNotificationRetentionDays = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.NOTIFICATION_RETENTION_DAYS, 180), 730);

export const getNotificationCleanupIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  Math.max(
    positiveInteger(env.NOTIFICATION_CLEANUP_INTERVAL_MS, 6 * 60 * 60 * 1000),
    60 * 60 * 1000,
  );

export const shouldLogWorkerNoop = (
  env: NodeJS.ProcessEnv = process.env,
) => isEnabled(env.WORKER_LOG_NOOP);

export const getAppointmentReminderLeadMinutes = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.APPOINTMENT_REMINDER_LEAD_MINUTES, 120);

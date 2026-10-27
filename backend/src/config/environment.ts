const MIN_SECRET_LENGTH = 32;
const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

const isEnabled = (value?: string) =>
  TRUE_VALUES.has((value || "").trim().toLowerCase());

export const isProductionLike = (env: NodeJS.ProcessEnv = process.env) =>
  env.NODE_ENV === "production" || isEnabled(env.RENDER);

const assertStrongSecret = (
  env: NodeJS.ProcessEnv,
  name: "JWT_SECRET" | "OTP_SECRET" | "LOOKUP_GRANT_SECRET",
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

const validateProductionMomo = (env: NodeJS.ProcessEnv) => {
  if (!isEnabled(env.PAYMENT_MOMO_ENABLED)) return;

  for (const name of [
    "MOMO_PARTNER_CODE",
    "MOMO_ACCESS_KEY",
    "MOMO_SECRET_KEY",
    "MOMO_REDIRECT_URL",
    "MOMO_IPN_URL",
  ] as const) {
    if (!env[name]?.trim()) {
      throw new Error(`${name} is required when MoMo payment is enabled.`);
    }
  }

  for (const name of [
    "MOMO_ENDPOINT",
    "MOMO_REDIRECT_URL",
    "MOMO_IPN_URL",
  ] as const) {
    const value = env[name]?.trim();
    if (!value && name === "MOMO_ENDPOINT") continue;
    let parsed: URL;
    try {
      parsed = new URL(value!);
    } catch {
      throw new Error(`${name} must be a valid HTTPS URL.`);
    }
    if (parsed.protocol !== "https:") {
      throw new Error(`${name} must be a valid HTTPS URL.`);
    }
  }
};

export const validateRuntimeEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  if (!isProductionLike(env)) return;

  assertStrongSecret(env, "JWT_SECRET");
  assertStrongSecret(env, "OTP_SECRET");
  assertStrongSecret(env, "LOOKUP_GRANT_SECRET");

  if (isEnabled(env.OTP_DEBUG_ENABLED)) {
    throw new Error("OTP_DEBUG_ENABLED must be disabled in production.");
  }

  if (isEnabled(env.PAYMENT_MOCK_ENABLED)) {
    throw new Error("PAYMENT_MOCK_ENABLED must be disabled in production.");
  }

  const databaseUrl = requireProductionValue(env, "DATABASE_URL");
  if (env.TEST_DATABASE_URL?.trim() === databaseUrl) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL.");
  }

  validateProductionFrontendOrigins(env);
  validateProductionMomo(env);

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

export const resolveLookupGrantSecret = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const secret =
    env.LOOKUP_GRANT_SECRET?.trim() ||
    (!isProductionLike(env)
      ? env.OTP_SECRET?.trim() || env.JWT_SECRET?.trim() || "dev_lookup_secret"
      : "");

  if (!secret) {
    throw new Error("LOOKUP_GRANT_SECRET is required in production.");
  }

  return secret;
};

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getDatabaseTransactionTimeoutMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.DATABASE_TRANSACTION_TIMEOUT_MS, 15_000), 30_000);

export const getDatabaseTransactionMaxWaitMs = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.DATABASE_TRANSACTION_MAX_WAIT_MS, 5_000), 15_000);

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
) => positiveInteger(env.APPOINTMENT_RECONCILIATION_INTERVAL_MS, 60_000);

export const getAppointmentReconciliationBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.APPOINTMENT_RECONCILIATION_BATCH_SIZE, 100);

export const getSlotReconciliationIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.SLOT_RECONCILIATION_INTERVAL_MS, 5 * 60_000);

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
    positiveInteger(env.NOTIFICATION_WORKER_INTERVAL_MS, 30_000),
    5_000,
  );

export const getNotificationDispatchBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => Math.min(positiveInteger(env.NOTIFICATION_DISPATCH_BATCH_SIZE, 100), 500);

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

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

export const getBookingHoldMinutes = (env: NodeJS.ProcessEnv = process.env) =>
  positiveInteger(env.BOOKING_HOLD_MINUTES, 10);

export const getAppointmentReconciliationIntervalMs = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.APPOINTMENT_RECONCILIATION_INTERVAL_MS, 60_000);

export const getAppointmentReconciliationBatchSize = (
  env: NodeJS.ProcessEnv = process.env,
) => positiveInteger(env.APPOINTMENT_RECONCILIATION_BATCH_SIZE, 100);

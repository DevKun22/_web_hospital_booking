const normalizeDatabaseUrl = (value: string) => {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
};

export const assertSafeTestDatabase = () => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for integration tests. Use a dedicated PostgreSQL database or schema whose name contains 'test'.",
    );
  }

  const parsed = new URL(testDatabaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("TEST_DATABASE_URL must use PostgreSQL.");
  }

  const databaseMarker = [
    parsed.pathname,
    parsed.searchParams.get("schema") || "",
  ]
    .join(" ")
    .toLowerCase();

  const hasTestMarker = databaseMarker.includes("test");

  if (!hasTestMarker) {
    throw new Error(
      "Refusing to run destructive integration tests: the database name or schema must contain 'test'. There is no override for an unmarked database.",
    );
  }

  const developmentDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (
    developmentDatabaseUrl &&
    normalizeDatabaseUrl(testDatabaseUrl) ===
      normalizeDatabaseUrl(developmentDatabaseUrl)
  ) {
    throw new Error(
      "Refusing to run destructive integration tests: TEST_DATABASE_URL must not equal DATABASE_URL.",
    );
  }

  return testDatabaseUrl;
};

export const buildIntegrationEnvironment = () => {
  const testDatabaseUrl = assertSafeTestDatabase();

  return {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: testDatabaseUrl,
    REDIS_URL: "",
    OTP_DEBUG_ENABLED: "true",
    JWT_SECRET: "phase0_test_jwt_secret_at_least_32_chars",
    OTP_SECRET: "phase0_test_otp_secret_at_least_32_chars",
    LOOKUP_GRANT_SECRET: "phase0_test_lookup_secret_at_least_32_chars",
    PAYMENT_MOCK_ENABLED: "true",
    DASHBOARD_COOKIE_SAME_SITE: "lax",
  };
};

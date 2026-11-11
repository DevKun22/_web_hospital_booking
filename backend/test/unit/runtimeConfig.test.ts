import assert from "node:assert/strict";
import test from "node:test";

import { getRuntimeConfig } from "../../src/config/runtimeConfig.js";

test("runtime config parses bounded numeric values and explicit zero TTL", () => {
  const config = getRuntimeConfig({
    PORT: "invalid",
    CHATBOT_AI_TIMEOUT_MS: "250",
    CHATBOT_CONTEXT_CACHE_TTL_MS: "0",
    CHATBOT_SETTINGS_CACHE_TTL_MS: "9999999",
    PUBLIC_SEARCH_CACHE_TTL_MS: "0",
  });

  assert.equal(config.server.port, 4000);
  assert.equal(config.chatbot.aiTimeoutMs, 1_000);
  assert.equal(config.chatbot.contextCacheTtlMs, 0);
  assert.equal(config.chatbot.settingsCacheTtlMs, 10 * 60_000);
  assert.equal(config.publicSearch.cacheTtlMs, 0);
});

test("runtime config normalizes URLs, flags and credential fallbacks", () => {
  const config = getRuntimeConfig({
    FRONTEND_URLS: " https://web.example.test,https://admin.example.test ",
    PAYMENT_VNPAY_ENABLED: "YES",
    PAYMENT_RESULT_URL: " ",
    FIREBASE_API_KEY: " firebase-key ",
    PROJECT_ID: " project-id ",
    TEXTBEE_API_URL: "https://sms.example.test/",
    DASHBOARD_REFRESH_TOKEN_DAYS: "14d",
  });

  assert.equal(config.payment.resultUrl, "https://web.example.test/thanh-toan/ket-qua");
  assert.equal(config.payment.vnpayEnabled, true);
  assert.equal(config.chatbot.firebaseApiKey, "firebase-key");
  assert.equal(config.chatbot.projectId, "project-id");
  assert.equal(config.sms.baseUrl, "https://sms.example.test");
  assert.equal(config.dashboardAuth.refreshTokenDays, 14);
});

test("runtime config is evaluated per call for isolated tests and scripts", () => {
  const env: NodeJS.ProcessEnv = { JWT_SECRET: "first" };
  assert.equal(getRuntimeConfig(env).jwt.secret, "first");

  env.JWT_SECRET = "second";
  assert.equal(getRuntimeConfig(env).jwt.secret, "second");
});

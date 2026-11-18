import assert from "node:assert/strict";
import test from "node:test";

import { getRuntimeConfig } from "../../src/config/runtimeConfig.js";

test("runtime config parses bounded numeric values and explicit zero TTL", () => {
  const config = getRuntimeConfig({
    PORT: "invalid",
    CHATBOT_AI_TIMEOUT_MS: "250",
    CHATBOT_CONTEXT_CACHE_TTL_MS: "0",
    CHATBOT_SETTINGS_CACHE_TTL_MS: "9999999",
    PUBLIC_SEARCH_INDEX_TTL_MS: "1",
  });

  assert.equal(config.server.port, 4000);
  assert.equal(config.chatbot.aiTimeoutMs, 1_000);
  assert.equal(config.chatbot.contextCacheTtlMs, 0);
  assert.equal(config.chatbot.settingsCacheTtlMs, 10 * 60_000);
  assert.equal(config.publicSearch.indexTtlMs, 5_000);
});

test("runtime config normalizes URLs, flags and flags", () => {
  const config = getRuntimeConfig({
    FRONTEND_URLS: " https://web.example.test,https://admin.example.test ",
    PAYMENT_VNPAY_ENABLED: "YES",
    PAYMENT_RESULT_URL: " ",
    TEXTBEE_API_URL: "https://sms.example.test/",
    DASHBOARD_REFRESH_TOKEN_DAYS: "14d",
  });

  assert.equal(config.payment.resultUrl, "https://web.example.test/thanh-toan/ket-qua");
  assert.equal(config.payment.vnpayEnabled, true);
  assert.equal(config.sms.baseUrl, "https://sms.example.test");
  assert.equal(config.dashboardAuth.refreshTokenDays, 14);
});

test("runtime config is evaluated per call for isolated tests and scripts", () => {
  const env: NodeJS.ProcessEnv = { JWT_SECRET: "first" };
  assert.equal(getRuntimeConfig(env).jwt.secret, "first");

  env.JWT_SECRET = "second";
  assert.equal(getRuntimeConfig(env).jwt.secret, "second");
});

test("Redis profile free keeps background commands near zero and paid favors latency", () => {
  const free = getRuntimeConfig({});
  assert.equal(free.redis.profile, "free");
  assert.equal(free.redis.queueMetrics, false);
  assert.equal(free.redis.rateLimitStore, "memory");
  assert.equal(free.redis.rbacSync, "local");
  assert.equal(free.bullmq.drainDelaySeconds, 60);
  assert.equal(free.bullmq.stalledIntervalMs, 300_000);

  const paid = getRuntimeConfig({ REDIS_PROFILE: "PAID" });
  assert.equal(paid.redis.profile, "paid");
  assert.equal(paid.redis.queueMetrics, true);
  assert.equal(paid.redis.rateLimitStore, "redis");
  assert.equal(paid.redis.rbacSync, "redis");
  assert.equal(paid.bullmq.drainDelaySeconds, 10);
  assert.equal(paid.bullmq.stalledIntervalMs, 30_000);
});

test("Redis profile values can be overridden one by one and bad values fall back to the profile", () => {
  const config = getRuntimeConfig({
    REDIS_PROFILE: "free",
    RUNTIME_METRICS_QUEUES: "true",
    RATE_LIMIT_STORE: "redis",
    RBAC_SYNC: "bogus",
    BULLMQ_DRAIN_DELAY_SECONDS: "2",
    QUEUE_ENQUEUE_TIMEOUT_MS: "250",
  });
  assert.equal(config.redis.queueMetrics, true);
  assert.equal(config.redis.rateLimitStore, "redis");
  assert.equal(config.redis.rbacSync, "local");
  assert.equal(config.bullmq.drainDelaySeconds, 5, "không cho thăm dò dày hơn 5 giây");
  assert.equal(config.redis.enqueueTimeoutMs, 250);
  assert.equal(getRuntimeConfig({ REDIS_PROFILE: "typo" }).redis.profile, "free");
  assert.equal(getRuntimeConfig({ OTP_ENQUEUE_TIMEOUT_MS: "400" }).redis.enqueueTimeoutMs, 400);
});

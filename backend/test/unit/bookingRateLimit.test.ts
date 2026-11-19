import assert from "node:assert/strict";
import test from "node:test";

process.env.RATE_LIMIT_ENABLED = "true";
process.env.REDIS_PROFILE = "free";
delete process.env.REDIS_URL;
delete process.env.QUEUE_REDIS_URL;

const { bookingCreateEmailLimiter, bookingCreateIpLimiter } = await import("../../src/middlewares/publicRateLimits.js");
const { errorMiddleware } = await import("../../src/middlewares/error.middleware.js");

type Outcome = { passed: boolean; status?: number; message?: string; retryAfter?: string };

const attempt = (limiter: (req: any, res: any, next: (error?: any) => void) => unknown, req: Record<string, unknown>) =>
  new Promise<Outcome>((resolve) => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (key: string, value: string) => (headers[key] = value) };
    void limiter(req, res, (error?: { statusCode?: number; message?: string }) =>
      resolve(error ? { passed: false, status: error.statusCode, message: error.message, retryAfter: headers["Retry-After"] } : { passed: true }),
    );
  });

const request = (ip: string, email: string) => ({
  body: { patientEmail: email },
  headers: { "x-forwarded-for": ip },
  socket: { remoteAddress: ip },
  ip,
});

test("the email limiter lets a normal retry pattern through and its message does not claim a booking was made", async () => {
  const email = "normal.user@example.test";
  for (let index = 1; index <= 10; index += 1) {
    assert.equal((await attempt(bookingCreateEmailLimiter as never, request("198.51.100.1", email))).passed, true, `attempt ${index}`);
  }
  const blocked = await attempt(bookingCreateEmailLimiter as never, request("198.51.100.1", email));
  assert.equal(blocked.passed, false);
  assert.equal(blocked.status, 429);
  assert.ok(!/đã đặt lịch/i.test(blocked.message ?? ""), blocked.message);
  assert.ok(Number(blocked.retryAfter) > 0);
});

test("the IP limiter tolerates many people behind one shared address before blocking", async () => {
  for (let index = 1; index <= 30; index += 1) {
    assert.equal((await attempt(bookingCreateIpLimiter as never, request("198.51.100.2", `user${index}@example.test`))).passed, true, `attempt ${index}`);
  }
  assert.equal((await attempt(bookingCreateIpLimiter as never, request("198.51.100.2", "one.more@example.test"))).status, 429);
  // Địa chỉ khác không bị ảnh hưởng.
  assert.equal((await attempt(bookingCreateIpLimiter as never, request("198.51.100.3", "other@example.test"))).passed, true);
});

test("a rate-limit error body carries retryAfterSeconds so a cross-origin browser can show a countdown", () => {
  let body: Record<string, unknown> = {};
  const res = {
    headersSent: false,
    getHeader: (name: string) => (name === "Retry-After" ? "480" : undefined),
    status() {
      return this;
    },
    json(payload: Record<string, unknown>) {
      body = payload;
      return this;
    },
  };
  const error = Object.assign(new Error("Có quá nhiều yêu cầu"), { statusCode: 429, code: "RATE_LIMITED" });
  errorMiddleware(error, { requestId: "r1", method: "POST", originalUrl: "/x" } as never, res as never, () => undefined);
  assert.equal(body.retryAfterSeconds, 480);
  assert.equal(body.code, "RATE_LIMITED");

  // Lỗi không phải 429 không có trường này.
  const plain = { ...res, getHeader: () => undefined };
  errorMiddleware(Object.assign(new Error("x"), { statusCode: 409 }), { requestId: "r2", method: "POST", originalUrl: "/x" } as never, plain as never, () => undefined);
  assert.equal("retryAfterSeconds" in body, false);
});

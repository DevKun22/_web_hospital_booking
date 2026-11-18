import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInlineWorkers, startInlineWorkers } from "../../src/workers/inline.js";

test("INLINE_WORKERS trống thì không chạy worker nào", () => {
  assert.deepEqual(parseInlineWorkers(undefined), []);
  assert.deepEqual(parseInlineWorkers("  "), []);
});

test("INLINE_WORKERS tách, chuẩn hóa và loại trùng", () => {
  assert.deepEqual(parseInlineWorkers("OTP, appointments ,otp"), [
    "otp",
    "appointments",
  ]);
});

test("INLINE_WORKERS từ chối tên không hợp lệ", () => {
  assert.throws(() => parseInlineWorkers("otp,sms"), /không hợp lệ: sms/);
});

test("INLINE_WORKERS nhận worker đối soát thanh toán", () => {
  assert.deepEqual(parseInlineWorkers("payments"), ["payments"]);
});

test("một worker khởi động lỗi không làm sập API và các worker còn lại vẫn chạy", async () => {
  const started: string[] = [];
  const result = await startInlineWorkers("otp,appointments,payments", {
    otp: async () => {
      throw new Error("Redis hết hạn mức");
    },
    appointments: async () => {
      started.push("appointments");
    },
    notifications: async () => undefined,
    payments: async () => {
      started.push("payments");
    },
  });

  assert.deepEqual(result, ["otp", "appointments", "payments"]);
  assert.deepEqual(started, ["appointments", "payments"]);
});

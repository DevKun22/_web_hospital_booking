import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInlineWorkers } from "../../src/workers/inline.js";

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

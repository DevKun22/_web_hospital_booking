import assert from "node:assert/strict";
import test from "node:test";

import { sealOtp, unsealOtp } from "../../src/utils/otpJobSeal.js";

test("a sealed OTP round-trips and never contains the plain code", () => {
  const sealed = sealOtp("483920");
  assert.ok(!sealed.includes("483920"));
  assert.equal(unsealOtp(sealed), "483920");
});

test("sealing is randomized and tampering is rejected", () => {
  assert.notEqual(sealOtp("123456"), sealOtp("123456"));
  const sealed = sealOtp("123456");
  const raw = Buffer.from(sealed, "base64url");
  raw[raw.length - 1] ^= 1;
  assert.throws(() => unsealOtp(raw.toString("base64url")));
  assert.throws(() => unsealOtp("abc"));
});

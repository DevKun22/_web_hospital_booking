import assert from "node:assert/strict";
import test from "node:test";
import {
  getEffectivePatientExpiry,
  getPatientAbsoluteExpiry,
  patientSessionPolicy,
} from "../../src/config/patientSessionPolicy.js";

test("web and unknown clients use the conservative web absolute lifetime", () => {
  const startedAt = new Date("2030-01-01T00:00:00.000Z");
  const expected = startedAt.getTime() + patientSessionPolicy.webAbsoluteMs;

  assert.equal(getPatientAbsoluteExpiry("web", startedAt).getTime(), expected);
  assert.equal(getPatientAbsoluteExpiry(undefined, startedAt).getTime(), expected);
});

test("native mobile clients use the mobile absolute lifetime", () => {
  const startedAt = new Date("2030-01-01T00:00:00.000Z");
  const expected = startedAt.getTime() + patientSessionPolicy.mobileAbsoluteMs;

  assert.equal(
    getPatientAbsoluteExpiry("android", startedAt).getTime(),
    expected,
  );
  assert.equal(getPatientAbsoluteExpiry("ios", startedAt).getTime(), expected);
});

test("effective expiry never extends the expiry already stored", () => {
  const createdAt = new Date("2030-01-01T00:00:00.000Z");
  const storedExpiresAt = new Date("2030-01-01T01:00:00.000Z");

  assert.equal(
    getEffectivePatientExpiry({
      platform: "android",
      createdAt,
      storedExpiresAt,
    }).getTime(),
    storedExpiresAt.getTime(),
  );
});

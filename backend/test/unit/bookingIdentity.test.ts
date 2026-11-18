import assert from "node:assert/strict";
import { test } from "node:test";

const { canSkipBookingOtp } = await import("../../src/services/bookingIdentity.js");

test("a logged-in patient booking for themself skips the booking OTP", () => {
  assert.equal(canSkipBookingOtp({ isAuthenticated: true, dependentProfileId: null }), true);
  assert.equal(canSkipBookingOtp({ isAuthenticated: true }), true);
});

test("guests and dependent bookings still require the booking OTP", () => {
  assert.equal(canSkipBookingOtp({ isAuthenticated: false }), false);
  assert.equal(canSkipBookingOtp({ isAuthenticated: true, dependentProfileId: "dep-1" }), false);
});

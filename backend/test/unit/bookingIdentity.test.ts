import assert from "node:assert/strict";
import { test } from "node:test";

const { decideGuestBookingIdentity } = await import(
  "../../src/services/bookingIdentity.js"
);

test("a phone without an account creates a new account on either channel", () => {
  for (const channel of ["EMAIL", "SMS"] as const) {
    assert.equal(
      decideGuestBookingIdentity({
        channel,
        existing: null,
        bookingEmail: "new@example.com",
      }),
      "NEW_ACCOUNT",
    );
  }
});

test("an SMS OTP proves the phone, so an existing account may be used", () => {
  assert.equal(
    decideGuestBookingIdentity({
      channel: "SMS",
      existing: { email: "owner@example.com", isPhoneVerified: true },
      bookingEmail: "other@example.com",
    }),
    "PHONE_PROVEN_BY_SMS",
  );
});

test("an email OTP only proves the email, never someone else's phone account", () => {
  // The takeover case: attacker books with the victim's phone and their own email.
  assert.equal(
    decideGuestBookingIdentity({
      channel: "EMAIL",
      existing: { email: "victim@example.com", isPhoneVerified: true },
      bookingEmail: "attacker@example.com",
    }),
    "LOGIN_REQUIRED",
  );
});

test("a phone-verified account without an email cannot be claimed by email", () => {
  assert.equal(
    decideGuestBookingIdentity({
      channel: "EMAIL",
      existing: { email: null, isPhoneVerified: true },
      bookingEmail: "attacker@example.com",
    }),
    "LOGIN_REQUIRED",
  );
});

test("the same email, ignoring case and spaces, is the account owner", () => {
  assert.equal(
    decideGuestBookingIdentity({
      channel: "EMAIL",
      existing: { email: "Owner@Example.com", isPhoneVerified: true },
      bookingEmail: "  owner@example.com ",
    }),
    "SAME_EMAIL_OWNER",
  );
});

test("an unclaimed shell account may receive the first verified email", () => {
  assert.equal(
    decideGuestBookingIdentity({
      channel: "EMAIL",
      existing: { email: null, isPhoneVerified: false },
      bookingEmail: "first@example.com",
    }),
    "UNCLAIMED_ACCOUNT",
  );
});

test("an account claimed by another email is no longer unclaimed", () => {
  // Covers the race: two guests booked on the same shell, the first one claimed it.
  assert.equal(
    decideGuestBookingIdentity({
      channel: "EMAIL",
      existing: { email: "first@example.com", isPhoneVerified: false },
      bookingEmail: "second@example.com",
    }),
    "LOGIN_REQUIRED",
  );
});

test("an email booking without an email never matches an existing account", () => {
  assert.equal(
    decideGuestBookingIdentity({
      channel: "EMAIL",
      existing: { email: "owner@example.com", isPhoneVerified: true },
      bookingEmail: null,
    }),
    "LOGIN_REQUIRED",
  );
});

import jwt, { type JwtPayload } from "jsonwebtoken";

import { resolveOtpSecret } from "../config/environment.js";

const BOOKING_HOLD_AUDIENCE = "booking-hold-control";
const BOOKING_HOLD_ISSUER = "hospital-booking-api";

interface BookingHoldGrantPayload extends JwtPayload {
  purpose: "RELEASE_BOOKING_HOLD";
}

export const signBookingHoldReleaseGrant = (input: {
  appointmentId: string;
  expiresAt: Date;
}) => {
  const remainingSeconds = Math.max(
    Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000),
    1,
  );
  return jwt.sign(
    { purpose: "RELEASE_BOOKING_HOLD" },
    resolveOtpSecret(),
    {
      subject: input.appointmentId,
      audience: BOOKING_HOLD_AUDIENCE,
      issuer: BOOKING_HOLD_ISSUER,
      expiresIn: remainingSeconds,
    },
  );
};

export const verifyBookingHoldReleaseGrant = (
  token: string,
  appointmentId: string,
) => {
  const payload = jwt.verify(token, resolveOtpSecret(), {
    audience: BOOKING_HOLD_AUDIENCE,
    issuer: BOOKING_HOLD_ISSUER,
    subject: appointmentId,
  });
  if (
    typeof payload === "string" ||
    payload.purpose !== "RELEASE_BOOKING_HOLD"
  ) {
    throw new Error("Invalid booking hold grant payload");
  }
  return payload as BookingHoldGrantPayload;
};

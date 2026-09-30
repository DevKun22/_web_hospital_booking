import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { resolveLookupGrantSecret } from "../config/environment.js";

export const LOOKUP_GRANT_AUDIENCE = "patient-lookup";

export const LOOKUP_GRANT_SCOPES = [
  "appointments:read",
  "results:read",
  "invoices:read",
  "payments:write",
] as const;

export type LookupGrantScope = (typeof LOOKUP_GRANT_SCOPES)[number];

export interface LookupGrantPayload extends JwtPayload {
  sub: string;
  aud: string | string[];
  scopes: LookupGrantScope[];
  purpose: "LOOKUP_RESULT";
  verifiedAt: string;
}

const lookupGrantSecret = resolveLookupGrantSecret();
const lookupGrantExpiresIn = (process.env.LOOKUP_GRANT_EXPIRES_IN ||
  "15m") as SignOptions["expiresIn"];

export const signLookupGrant = (input: {
  patientId: string;
  scopes?: LookupGrantScope[];
}) => {
  const verifiedAt = new Date();
  const token = jwt.sign(
    {
      scopes: input.scopes || [...LOOKUP_GRANT_SCOPES],
      purpose: "LOOKUP_RESULT",
      verifiedAt: verifiedAt.toISOString(),
    },
    lookupGrantSecret,
    {
      audience: LOOKUP_GRANT_AUDIENCE,
      subject: input.patientId,
      jwtid: randomUUID(),
      expiresIn: lookupGrantExpiresIn,
    },
  );
  const decoded = jwt.decode(token) as JwtPayload;
  const expiresAt = decoded.exp
    ? new Date(decoded.exp * 1000)
    : new Date(verifiedAt.getTime() + 15 * 60 * 1000);

  return {
    token,
    tokenType: "Bearer" as const,
    expiresAt,
    expiresIn: Math.max(
      Math.floor((expiresAt.getTime() - verifiedAt.getTime()) / 1000),
      0,
    ),
    scopes: input.scopes || [...LOOKUP_GRANT_SCOPES],
  };
};

export const verifyLookupGrant = (token: string): LookupGrantPayload => {
  const payload = jwt.verify(token, lookupGrantSecret, {
    audience: LOOKUP_GRANT_AUDIENCE,
  });

  if (
    typeof payload === "string" ||
    !payload.sub ||
    payload.purpose !== "LOOKUP_RESULT" ||
    !Array.isArray(payload.scopes)
  ) {
    throw new Error("Invalid lookup grant payload");
  }

  return payload as LookupGrantPayload;
};


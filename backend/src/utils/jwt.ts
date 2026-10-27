import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const PATIENT_TOKEN_AUDIENCE = "hospital-patient-api";
const DASHBOARD_TOKEN_AUDIENCE = "hospital-dashboard-api";
const TOKEN_ISSUER = "hospital-booking-api";

export interface TokenPayload extends JwtPayload {
  userId: string;
  role: string;
  sessionId?: string;
  tokenType?: "DASHBOARD_ACCESS" | "PATIENT_ACCESS";
}

export const generateDashboardAccessToken = (
  payload: Omit<TokenPayload, "tokenType"> & { sessionId: string },
  expiresIn: SignOptions["expiresIn"],
) =>
  jwt.sign(
    {
      ...payload,
      tokenType: "DASHBOARD_ACCESS",
    },
    JWT_SECRET,
    {
      expiresIn,
      audience: DASHBOARD_TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
      subject: payload.userId,
    },
  );

export const verifyDashboardAccessToken = (token: string): TokenPayload => {
  const payload = jwt.verify(token, JWT_SECRET, {
    audience: DASHBOARD_TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  }) as TokenPayload;

  if (
    payload.tokenType !== "DASHBOARD_ACCESS" ||
    !payload.sessionId ||
    payload.sub !== payload.userId
  ) {
    throw new Error("Invalid dashboard access token");
  }

  return payload;
};

export const generatePatientAccessToken = (
  payload: Omit<TokenPayload, "role" | "tokenType"> & {
    sessionId: string;
  },
  expiresIn: SignOptions["expiresIn"],
) =>
  jwt.sign(
    {
      ...payload,
      role: "PATIENT",
      tokenType: "PATIENT_ACCESS",
    },
    JWT_SECRET,
    {
      expiresIn,
      audience: PATIENT_TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
      subject: payload.userId,
    },
  );

export const verifyPatientAccessToken = (token: string): TokenPayload => {
  const payload = jwt.verify(token, JWT_SECRET, {
    audience: PATIENT_TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  }) as TokenPayload;

  if (
    payload.tokenType !== "PATIENT_ACCESS" ||
    payload.role !== "PATIENT" ||
    !payload.sessionId ||
    payload.sub !== payload.userId
  ) {
    throw new Error("Invalid patient access token");
  }

  return payload;
};

export const decodeToken = (token: string) => {
  return jwt.decode(token);
};

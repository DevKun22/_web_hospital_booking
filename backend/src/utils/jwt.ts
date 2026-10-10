import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const PATIENT_TOKEN_AUDIENCE = "hospital-patient-api";
const TOKEN_ISSUER = "hospital-booking-api";

export interface TokenPayload extends JwtPayload {
  userId: string;
  role: string;
  sessionId?: string;
  tokenType?: "DASHBOARD_ACCESS" | "PATIENT_ACCESS";
}

const JWT_EXPIRES_IN: SignOptions["expiresIn"] = (process.env.JWT_EXPIRES_IN ||
  "7d") as SignOptions["expiresIn"];

export const generateToken = (
  payload: TokenPayload,
  expiresIn: SignOptions["expiresIn"] = JWT_EXPIRES_IN,
) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
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

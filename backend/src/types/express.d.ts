import type { TokenPayload } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      patient?: TokenPayload & { sessionId: string; role: "PATIENT" };
      requestId: string;
    }
  }
}

export {};

import type { TokenPayload } from "../utils/jwt.js";
import type { LookupGrantPayload } from "../utils/lookupGrant.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      lookupGrant?: LookupGrantPayload;
      requestId: string;
    }
  }
}

export {};

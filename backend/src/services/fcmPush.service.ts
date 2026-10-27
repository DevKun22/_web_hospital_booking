import { getMessaging } from "firebase-admin/messaging";
import {
  getFirebaseAdminApp,
  isFirebaseAdminConfigured,
} from "../config/firebaseAdmin.js";

export type PushSendInput = {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushSendResult =
  | { outcome: "DISABLED" }
  | { outcome: "SENT"; providerMessageId: string }
  | { outcome: "INVALID_TOKEN"; error: string }
  | { outcome: "FAILED"; error: string };

const invalidTokenCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const errorDetails = (error: unknown) => {
  const fallback = "Không gửi được thông báo FCM";
  if (!error || typeof error !== "object") {
    return { code: "", message: fallback };
  }

  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate.code === "string" ? candidate.code : "",
    message:
      typeof candidate.message === "string"
        ? candidate.message.slice(0, 1000)
        : fallback,
  };
};

class FcmPushService {
  isConfigured() {
    return isFirebaseAdminConfigured();
  }

  async send(input: PushSendInput): Promise<PushSendResult> {
    if (!this.isConfigured()) return { outcome: "DISABLED" };

    try {
      const providerMessageId = await getMessaging(
        getFirebaseAdminApp(),
      ).send({
        token: input.token,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: input.data,
        android: {
          priority: "high",
          notification: {
            channelId: "appointment_updates",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
        },
      });
      return { outcome: "SENT", providerMessageId };
    } catch (error) {
      const details = errorDetails(error);
      return invalidTokenCodes.has(details.code)
        ? { outcome: "INVALID_TOKEN", error: details.message }
        : { outcome: "FAILED", error: details.message };
    }
  }
}

export default new FcmPushService();

import { getMessaging } from "firebase-admin/messaging";
import {
  getFirebaseAdminApp,
  isFirebaseAdminConfigured,
} from "../config/firebaseAdmin.js";

type PushSendInput = {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

type PushSendResult =
  | { outcome: "DISABLED" }
  | { outcome: "SENT"; providerMessageId: string }
  | { outcome: "INVALID_TOKEN"; error: string }
  | { outcome: "FAILED"; error: string };

const FCM_BATCH_LIMIT = 500;

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

  // Gửi nhiều tin trong một lệnh gọi (Firebase Admin sendEach, tối đa 500 tin mỗi lô). Kết quả cùng thứ tự đầu vào;
  // lỗi của từng tin không làm hỏng cả lô.
  async sendBatch(inputs: PushSendInput[]): Promise<PushSendResult[]> {
    if (!this.isConfigured()) return inputs.map(() => ({ outcome: "DISABLED" as const }));

    const results: PushSendResult[] = [];
    for (let start = 0; start < inputs.length; start += FCM_BATCH_LIMIT) {
      const chunk = inputs.slice(start, start + FCM_BATCH_LIMIT);
      try {
        const response = await getMessaging(getFirebaseAdminApp()).sendEach(
          chunk.map((input) => ({
            token: input.token,
            notification: { title: input.title, body: input.body },
            data: input.data,
            android: {
              priority: "high" as const,
              notification: { channelId: "appointment_updates", sound: "default" },
            },
            apns: { payload: { aps: { sound: "default" } } },
          })),
        );
        for (const item of response.responses) {
          if (item.success) {
            results.push({ outcome: "SENT", providerMessageId: item.messageId ?? "" });
            continue;
          }
          const details = errorDetails(item.error);
          results.push(
            invalidTokenCodes.has(details.code)
              ? { outcome: "INVALID_TOKEN", error: details.message }
              : { outcome: "FAILED", error: details.message },
          );
        }
      } catch (error) {
        // Cả lô lỗi (mạng, xác thực): mọi tin đều thử lại sau.
        const details = errorDetails(error);
        for (let index = 0; index < chunk.length; index += 1) results.push({ outcome: "FAILED", error: details.message });
      }
    }
    return results;
  }
}

export default new FcmPushService();

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { AppError } from "../../../utils/appError.js";
import type { AIAdapter, GenerateReplyInput } from "./ai.adapter.js";

const getModel = (model?: string) =>
  model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

const DEFAULT_AI_TIMEOUT_MS = 8_000;
const MIN_AI_TIMEOUT_MS = 1_000;
// Keep the server-side AI budget below the mobile client's default 15-second
// receive timeout so the deterministic chatbot fallback can still respond.
const MAX_AI_TIMEOUT_MS = 12_000;

const getAIRequestTimeoutMs = () => {
  const configured = Number(process.env.CHATBOT_AI_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_AI_TIMEOUT_MS;
  return Math.min(
    MAX_AI_TIMEOUT_MS,
    Math.max(MIN_AI_TIMEOUT_MS, Math.trunc(configured)),
  );
};

const getFirebaseConfig = () => ({
  apiKey: process.env.FIREBASE_API_KEY || process.env.API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || process.env.STORAGE_BUCKET,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.APP_ID,
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID || process.env.MEASUREMENT_ID,
});

const getFirebaseApp = (): FirebaseApp => {
  const config = getFirebaseConfig();

  if (!config.apiKey) {
    throw new AppError("Chưa cấu hình FIREBASE_API_KEY hoặc API_KEY", 500);
  }

  if (!config.projectId) {
    throw new AppError(
      "Chưa cấu hình FIREBASE_PROJECT_ID hoặc PROJECT_ID",
      500,
    );
  }

  if (!config.appId) {
    throw new AppError("Chưa cấu hình FIREBASE_APP_ID hoặc APP_ID", 500);
  }

  return getApps()[0] || initializeApp(config);
};

export class GeminiAdapter implements AIAdapter {
  async generateReply(input: GenerateReplyInput) {
    const firebaseApp = getFirebaseApp();
    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: getModel(input.model),
      systemInstruction: input.systemPrompt,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    try {
      const result = await model.generateContent(input.userPrompt, {
        timeout: getAIRequestTimeoutMs(),
      });
      const text = result.response.text().trim();

      if (!text) {
        throw new AppError("Gemini không trả về nội dung", 502);
      }

      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw new AppError(
        error instanceof Error
          ? error.message
          : "Gemini không phản hồi thành công",
        502,
      );
    }
  }
}

export default new GeminiAdapter();

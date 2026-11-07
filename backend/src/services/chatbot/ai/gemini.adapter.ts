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

// Gọi REST trực tiếp thay vì kéo cả Firebase client SDK vào backend.
// - GEMINI_API_KEY: Gemini Developer API (generativelanguage.googleapis.com).
// - Nếu không có, dùng proxy Firebase AI Logic với FIREBASE_API_KEY +
//   FIREBASE_PROJECT_ID (cùng endpoint mà SDK firebase/ai đã dùng trước đây).
const resolveEndpoint = (model: string) => {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      apiKey: geminiKey,
    };
  }

  const firebaseKey = (process.env.FIREBASE_API_KEY || process.env.API_KEY)?.trim();
  const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID)?.trim();
  if (!firebaseKey || !projectId) {
    throw new AppError(
      "Chưa cấu hình GEMINI_API_KEY hoặc FIREBASE_API_KEY + FIREBASE_PROJECT_ID",
      500,
    );
  }
  return {
    url: `https://firebasevertexai.googleapis.com/v1beta/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(model)}:generateContent`,
    apiKey: firebaseKey,
  };
};

type GenerateContentResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

export class GeminiAdapter implements AIAdapter {
  async generateReply(input: GenerateReplyInput) {
    const endpoint = resolveEndpoint(getModel(input.model));

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": endpoint.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: input.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(getAIRequestTimeoutMs()),
      });

      const payload = (await response.json().catch(() => ({}))) as GenerateContentResponse;
      if (!response.ok) {
        throw new AppError(
          payload.error?.message || `Gemini trả về lỗi HTTP ${response.status}`,
          502,
        );
      }

      const text = (payload.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || "")
        .join("")
        .trim();

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

import { AppError } from "../../../utils/appError.js";
import type { AIAdapter, GenerateReplyInput } from "./ai.adapter.js";
import { getRuntimeConfig } from "../../../config/runtimeConfig.js";

const getModel = (model?: string) =>
  model || getRuntimeConfig().chatbot.model;

// Giữ ngân sách AI phía server thấp hơn timeout nhận mặc định 15 giây của mobile
// để chatbot vẫn có thể trả lời bằng fallback xác định.
const getAIRequestTimeoutMs = () => getRuntimeConfig().chatbot.aiTimeoutMs;

// Gọi REST trực tiếp thay vì kéo cả Firebase client SDK vào backend.
// - GEMINI_API_KEY: Gemini Developer API (generativelanguage.googleapis.com).
// - Nếu không có, dùng proxy Firebase AI Logic với FIREBASE_API_KEY +
//   FIREBASE_PROJECT_ID (cùng endpoint mà SDK firebase/ai đã dùng trước đây).
const resolveEndpoint = (model: string) => {
  const config = getRuntimeConfig().chatbot;
  const geminiKey = config.geminiApiKey;
  if (geminiKey) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      apiKey: geminiKey,
    };
  }

  const firebaseKey = config.firebaseApiKey;
  const projectId = config.projectId;
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

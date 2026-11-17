import { AppError } from "../../../utils/appError.js";
import type { AIAdapter, GenerateReplyInput } from "./ai.adapter.js";
import { getRuntimeConfig } from "../../../config/runtimeConfig.js";

// Gọi REST trực tiếp tới Gemini Developer API bằng GEMINI_API_KEY (khóa tạo ở Google AI Studio).
// Không dùng cổng Firebase AI Logic: cổng đó đòi App Check của ứng dụng khách nên máy chủ gọi bị từ chối (401).

const getModel = (model?: string) => model || getRuntimeConfig().chatbot.model;

// Giữ ngân sách AI phía máy chủ thấp hơn timeout nhận mặc định 15 giây của mobile
// để chatbot vẫn có thể trả lời bằng đường lùi xác định.
const getAIRequestTimeoutMs = () => getRuntimeConfig().chatbot.aiTimeoutMs;

export const resolveGeminiEndpoint = (
  model: string,
  method: "generateContent" | "embedContent" | "batchEmbedContents" = "generateContent",
) => {
  const apiKey = getRuntimeConfig().chatbot.geminiApiKey;
  if (!apiKey) throw new AppError("Chưa cấu hình GEMINI_API_KEY", 500);
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}`,
    apiKey,
  };
};

/** Có khóa API để gọi Gemini hay không; không có thì chatbot chỉ dùng quy tắc và tìm theo từ. */
export const isGeminiConfigured = () => Boolean(getRuntimeConfig().chatbot.geminiApiKey);

type GenerateContentResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

class GeminiAdapter implements AIAdapter {
  async generateReply(input: GenerateReplyInput) {
    const endpoint = resolveGeminiEndpoint(getModel(input.model));

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": endpoint.apiKey },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: input.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            // Việc ở đây là phân loại và diễn đạt ngắn từ dữ liệu cho sẵn: tắt "suy nghĩ" để phản hồi trong ngân sách thời gian.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(getAIRequestTimeoutMs()),
      });

      const raw = await response.text();
      let payload: GenerateContentResponse = {};
      try {
        payload = JSON.parse(raw) as GenerateContentResponse;
      } catch {
        // Phản hồi không phải JSON: giữ đoạn đầu để chẩn đoán.
      }
      if (!response.ok) {
        throw new AppError(
          `Gemini lỗi HTTP ${response.status}: ${payload.error?.message || raw.slice(0, 200) || "không có nội dung"}`,
          502,
        );
      }

      const text = (payload.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || "")
        .join("")
        .trim();
      if (!text) throw new AppError("Gemini không trả về nội dung", 502);
      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error instanceof Error ? error.message : "Gemini không phản hồi thành công", 502);
    }
  }
}

export default new GeminiAdapter();

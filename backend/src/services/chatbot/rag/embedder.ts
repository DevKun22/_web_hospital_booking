import { AppError } from "../../../utils/appError.js";
import { getRuntimeConfig } from "../../../config/runtimeConfig.js";
import { isGeminiConfigured, resolveGeminiEndpoint } from "../ai/gemini.adapter.js";

// Biến văn bản thành vector bằng Gemini embedding (cùng khóa API với phần sinh câu trả lời).
// Vector 768 chiều là đủ cho kho vài trăm đoạn và nhẹ khi lưu.

const DIMENSIONS = 768;
const BATCH_SIZE = 50;
const QUERY_CACHE_SIZE = 200;

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
type EmbedResponse = { embedding?: { values?: number[] }; error?: { message?: string } };
type BatchEmbedResponse = { embeddings?: { values?: number[] }[]; error?: { message?: string } };

const queryCache = new Map<string, number[]>();

export const embeddingModelName = () => getRuntimeConfig().chatbot.embeddingModel;

/** Có khóa API để gọi dịch vụ nhúng hay không; không có thì chatbot chỉ tìm theo từ. */
export const isEmbeddingConfigured = isGeminiConfigured;

const request = async <T>(method: "embedContent" | "batchEmbedContents", body: unknown): Promise<T> => {
  const model = embeddingModelName();
  const endpoint = resolveGeminiEndpoint(model, method);
  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": endpoint.apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(raw) as T & { error?: { message?: string } };
    } catch {
      return {} as T & { error?: { message?: string } };
    }
  })();
  if (!response.ok) {
    // Kèm đoạn đầu phản hồi để quản trị chẩn đoán được (sai mô hình, khóa không có quyền, endpoint không hỗ trợ).
    throw new AppError(`Dịch vụ nhúng lỗi HTTP ${response.status}: ${payload.error?.message || raw.slice(0, 200) || "không có nội dung"}`, 502);
  }
  return payload;
};

const requestPart = (text: string, taskType: TaskType) => ({
  model: `models/${embeddingModelName()}`,
  content: { parts: [{ text }] },
  taskType,
  outputDimensionality: DIMENSIONS,
});

/** Chuẩn hóa độ dài về 1 để so khớp bằng tích vô hướng. */
export const normalizeVector = (values: number[]) => {
  const length = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / length);
};

export const cosine = (a: number[], b: number[]) => {
  let sum = 0;
  const size = Math.min(a.length, b.length);
  for (let i = 0; i < size; i += 1) sum += a[i] * b[i];
  return sum;
};

/** Nhúng nhiều đoạn tri thức; trả về vector đã chuẩn hóa theo đúng thứ tự đầu vào. */
export const embedDocuments = async (texts: string[]): Promise<number[][]> => {
  const result: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const payload = await request<BatchEmbedResponse>("batchEmbedContents", {
      requests: batch.map((text) => requestPart(text, "RETRIEVAL_DOCUMENT")),
    });
    const vectors = payload.embeddings || [];
    if (vectors.length !== batch.length || vectors.some((item) => !item.values?.length)) {
      throw new AppError("Dịch vụ nhúng trả về số vector không khớp", 502);
    }
    result.push(...vectors.map((item) => normalizeVector(item.values as number[])));
  }
  return result;
};

/** Nhúng một câu hỏi; câu hỏi lặp lại được lấy từ bộ nhớ đệm để khỏi gọi dịch vụ ngoài. */
export const embedQuery = async (text: string): Promise<number[]> => {
  const key = text.trim().toLowerCase();
  const cached = queryCache.get(key);
  if (cached) return cached;
  const payload = await request<EmbedResponse>("embedContent", requestPart(text, "RETRIEVAL_QUERY"));
  const values = payload.embedding?.values;
  if (!values?.length) throw new AppError("Dịch vụ nhúng không trả về vector", 502);
  const vector = normalizeVector(values);
  if (queryCache.size >= QUERY_CACHE_SIZE) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, vector);
  return vector;
};

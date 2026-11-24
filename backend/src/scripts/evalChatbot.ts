import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../config/prisma.js";
import ChatbotNLUService from "../services/chatbot/ai/nlu.service.js";
import { isGeminiConfigured } from "../services/chatbot/ai/gemini.adapter.js";
import { embedQuery } from "../services/chatbot/rag/embedder.js";
import { KnowledgeIndex } from "../services/chatbot/rag/retriever.js";
import type { KnowledgeChunk, KnowledgeSourceType } from "../services/chatbot/rag/rag.types.js";
import { parseVietnameseDateTime } from "../services/chatbot/nlu/datetime.parser.js";
import { routeByHeuristics, routeByRules } from "../services/chatbot/router/route.js";
import { foldVietnamese } from "../services/chatbot/rules/text-normalizer.js";

// Đánh giá Kun V2 theo bộ dữ liệu test/eval/chatbot-eval.json. CHỈ ĐỌC: không ghi DB, không đồng bộ kho tri thức
// (không dùng KnowledgeService.retrieve vì nó có thể tự đồng bộ). Đo được:
//   - Bộ định tuyến không cần AI (quy tắc + đường lùi): độ chính xác trên các câu nó nhận định tuyến.
//   - Bộ phân tích ngày giờ: tỉ lệ đúng tuyệt đối.
//   - Truy hồi Recall@5, MRR@5 cho tìm theo từ / theo vector / lai, trên đoạn tri thức hiện có trong DB.
//   - Độ chính xác AI phân tích ý định: chỉ khi có GEMINI_API_KEY và truyền --nlu (tốn lượt gọi AI).
// Phần nào không chạy được thì ghi "chưa đo", không ước lượng.
//   npx tsx src/scripts/evalChatbot.ts [--nlu] [--out ../docs/chatbot-eval-result.json]

type Relevant = { type: KnowledgeSourceType; title: string };
type Dataset = {
  today: string;
  intents: { message: string; operation: string }[];
  dateTimes: { message: string; expected: Record<string, string> }[];
  retrieval: { query: string; relevant: Relevant[] }[];
};

const K = 5;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;

const dataset = JSON.parse(readFileSync(path.resolve(process.cwd(), "test/eval/chatbot-eval.json"), "utf8")) as Dataset;

const isRelevant = (chunk: KnowledgeChunk, relevant: Relevant[]) =>
  relevant.some((item) => item.type === chunk.sourceType && foldVietnamese(chunk.title).includes(foldVietnamese(item.title)));

const ruleOperation = (message: string) => {
  const rule = routeByRules(message);
  if (rule === "GREETING") return "GREETING";
  if (rule === "CAPABILITIES") return "ASK_CAPABILITIES";
  if (rule === "RESET") return "RESET_FLOW";
  return routeByHeuristics(message);
};

const evaluateRouter = () => {
  let routed = 0;
  let correct = 0;
  const errors: string[] = [];
  for (const item of dataset.intents) {
    const predicted = ruleOperation(item.message);
    if (!predicted) continue;
    routed += 1;
    if (predicted === item.operation) correct += 1;
    else errors.push(`${item.message} → ${predicted} (đúng: ${item.operation})`);
  }
  return { total: dataset.intents.length, routed, correct, precision: routed ? correct / routed : null, coverage: routed / dataset.intents.length, errors };
};

const evaluateDateTimes = () => {
  const errors: string[] = [];
  let correct = 0;
  for (const item of dataset.dateTimes) {
    const actual = parseVietnameseDateTime(item.message, dataset.today);
    if (JSON.stringify(actual, Object.keys(actual).sort()) === JSON.stringify(item.expected, Object.keys(item.expected).sort())) correct += 1;
    else errors.push(`${item.message} → ${JSON.stringify(actual)} (đúng: ${JSON.stringify(item.expected)})`);
  }
  return { total: dataset.dateTimes.length, correct, accuracy: correct / dataset.dateTimes.length, errors };
};

const evaluateRetrieval = async (index: KnowledgeIndex, mode: "lexical" | "semantic" | "hybrid", vectors: Map<string, number[]> | null) => {
  if (mode !== "lexical" && !vectors) return { status: "chưa đo", reason: "không có GEMINI_API_KEY để nhúng câu hỏi" };
  let recall = 0;
  let reciprocal = 0;
  const misses: string[] = [];
  for (const item of dataset.retrieval) {
    const hits = index.search(item.query, { queryVector: vectors?.get(item.query) ?? null, limit: K, mode });
    const rank = hits.findIndex((hit) => isRelevant(hit.chunk, item.relevant));
    if (rank >= 0) {
      recall += 1;
      reciprocal += 1 / (rank + 1);
    } else {
      misses.push(item.query);
    }
  }
  const total = dataset.retrieval.length;
  return { status: "đã đo", total, [`recallAt${K}`]: recall / total, [`mrrAt${K}`]: reciprocal / total, misses };
};

const evaluateNlu = async () => {
  if (!args.includes("--nlu")) return { status: "chưa đo", reason: "không truyền --nlu" };
  if (!isGeminiConfigured()) return { status: "chưa đo", reason: "không có GEMINI_API_KEY" };
  const catalog = { departments: [], packages: [], doctors: [] };
  let correct = 0;
  const errors: string[] = [];
  for (const item of dataset.intents) {
    try {
      const result = await ChatbotNLUService.extract({ message: item.message, draft: {}, catalog });
      if (result.operation === item.operation) correct += 1;
      else errors.push(`${item.message} → ${result.operation} (đúng: ${item.operation})`);
    } catch (error) {
      errors.push(`${item.message} → lỗi gọi AI: ${error instanceof Error ? error.message : "không rõ"}`);
    }
  }
  return { status: "đã đo", total: dataset.intents.length, correct, accuracy: correct / dataset.intents.length, errors };
};

const main = async () => {
  // Chỉ đọc đoạn tri thức đã lưu (kể cả vector đã nhúng); không đồng bộ, không ghi.
  const rows = await prisma.chatKnowledgeChunk.findMany({
    select: { id: true, sourceType: true, sourceId: true, title: true, content: true, url: true, embedding: true },
  });
  const chunks: KnowledgeChunk[] = rows.map((row) => ({ ...row, sourceType: row.sourceType as KnowledgeSourceType, embedding: row.embedding.length ? row.embedding : null }));
  const index = new KnowledgeIndex(chunks);

  let vectors: Map<string, number[]> | null = null;
  if (isGeminiConfigured() && index.embeddedCount > 0) {
    vectors = new Map();
    for (const item of dataset.retrieval) vectors.set(item.query, await embedQuery(item.query));
  }

  const result = {
    measuredAt: new Date().toISOString(),
    knowledge: { chunks: index.size, embedded: index.embeddedCount },
    router: evaluateRouter(),
    dateTime: evaluateDateTimes(),
    retrieval: {
      lexical: await evaluateRetrieval(index, "lexical", vectors),
      semantic: await evaluateRetrieval(index, "semantic", vectors),
      hybrid: await evaluateRetrieval(index, "hybrid", vectors),
    },
    nlu: await evaluateNlu(),
  };
  console.log(JSON.stringify(result, null, 2));
  if (outFile) writeFileSync(path.resolve(process.cwd(), outFile), JSON.stringify(result, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

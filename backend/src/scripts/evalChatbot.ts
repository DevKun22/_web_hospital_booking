import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../config/prisma.js";
import ChatbotNLUService, { type NLUHistoryTurn } from "../services/chatbot/ai/nlu.service.js";
import { isGeminiConfigured } from "../services/chatbot/ai/gemini.adapter.js";
import { embedQuery } from "../services/chatbot/rag/embedder.js";
import { answerFromSources, numbersAreGrounded } from "../services/chatbot/rag/generator.js";
import { KnowledgeIndex } from "../services/chatbot/rag/retriever.js";
import type { KnowledgeChunk, KnowledgeSourceType } from "../services/chatbot/rag/rag.types.js";
import { parseVietnameseDateTime } from "../services/chatbot/nlu/datetime.parser.js";
import { routeByHeuristics, routeByRules } from "../services/chatbot/router/route.js";
import { foldVietnamese } from "../services/chatbot/rules/text-normalizer.js";

// Đánh giá Kun V2 theo test/eval/chatbot-eval.json. CHỈ ĐỌC DB: không ghi, không đồng bộ kho tri thức (không dùng
// KnowledgeService.retrieve vì nó có thể tự đồng bộ). Phần cần AI chỉ chạy khi có GEMINI_API_KEY và cờ --nlu; thiếu thì ghi "chưa đo".
//   npm run eval:chatbot -- [--nlu] [--out ../docs/chatbot-eval-result.json]
//
// Định nghĩa chỉ số truy hồi (K = 5):
//   HitRate@K: tỉ lệ câu hỏi có ÍT NHẤT MỘT đoạn đúng trong K kết quả đầu.
//   Recall@K: trung bình theo câu hỏi của (số đoạn đúng nằm trong K kết quả đầu) / min(K, tổng số đoạn đúng có trong kho).
//   MRR@K: trung bình 1/thứ hạng của đoạn đúng đầu tiên (0 nếu không có trong K kết quả đầu).
// "Đoạn đúng" của một câu hỏi = mọi đoạn trong kho khớp nhãn (loại nguồn + tiêu đề chứa chuỗi, không phân biệt dấu).

type Relevant = { type: KnowledgeSourceType; title: string };
type RetrievalCase = { query: string; relevant: Relevant[] };
type IntentCase = { message: string; operation: string; entities?: { departmentName?: string; doctorName?: string; packageName?: string } };
type MultiTurnCase = { name: string; turns: { message: string; operation: string }[] };
type GenerationCase = { name: string; question: string; expect: "answer" | "no-answer"; mustMention?: string[] };
type Dataset = {
  today: string;
  intents: IntentCase[];
  intentsHoldout: IntentCase[];
  multiTurn: MultiTurnCase[];
  dateTimes: { message: string; expected: Record<string, string> }[];
  retrieval: RetrievalCase[];
  retrievalHoldout: RetrievalCase[];
  generation: GenerationCase[];
};

const K = 5;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;
const live = args.includes("--nlu");
const aiReady = isGeminiConfigured();
const blocked = (reason: string) => ({ status: "chưa đo", reason });

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

const evaluateRouter = (cases: IntentCase[]) => {
  let routed = 0;
  let correct = 0;
  const errors: string[] = [];
  for (const item of cases) {
    const predicted = ruleOperation(item.message);
    if (!predicted) continue;
    routed += 1;
    if (predicted === item.operation) correct += 1;
    else errors.push(`${item.message} → ${predicted} (đúng: ${item.operation})`);
  }
  return { total: cases.length, routed, correct, precision: routed ? correct / routed : null, coverage: routed / cases.length, errors };
};

const evaluateDateTimes = () => {
  const errors: string[] = [];
  let correct = 0;
  const canonical = (value: Record<string, string | undefined>) => JSON.stringify(Object.keys(value).sort().map((key) => [key, value[key]]));
  for (const item of dataset.dateTimes) {
    const actual = parseVietnameseDateTime(item.message, dataset.today);
    if (canonical(actual) === canonical(item.expected)) correct += 1;
    else errors.push(`${item.message} → ${JSON.stringify(actual)} (đúng: ${JSON.stringify(item.expected)})`);
  }
  return { total: dataset.dateTimes.length, correct, accuracy: correct / dataset.dateTimes.length, errors };
};

const evaluateRetrieval = (
  index: KnowledgeIndex,
  chunks: KnowledgeChunk[],
  cases: RetrievalCase[],
  mode: "lexical" | "semantic" | "hybrid",
  vectors: Map<string, number[]> | null,
) => {
  if (mode !== "lexical" && !vectors) return blocked("không có GEMINI_API_KEY để nhúng câu hỏi");
  let hits = 0;
  let recallSum = 0;
  let reciprocal = 0;
  const misses: { query: string; top: string[] }[] = [];
  for (const item of cases) {
    const results = index.search(item.query, { queryVector: vectors?.get(item.query) ?? null, limit: K, mode });
    const totalRelevant = chunks.filter((chunk) => isRelevant(chunk, item.relevant)).length;
    const found = results.filter((result) => isRelevant(result.chunk, item.relevant)).length;
    const rank = results.findIndex((result) => isRelevant(result.chunk, item.relevant));
    if (rank >= 0) {
      hits += 1;
      reciprocal += 1 / (rank + 1);
    } else {
      misses.push({ query: item.query, top: results.slice(0, 3).map((result) => `${result.chunk.sourceType}:${result.chunk.title}`) });
    }
    recallSum += totalRelevant ? found / Math.min(K, totalRelevant) : 0;
  }
  const total = cases.length;
  return { status: "đã đo", total, [`hitRateAt${K}`]: hits / total, [`recallAt${K}`]: recallSum / total, [`mrrAt${K}`]: reciprocal / total, misses };
};

const timed = async <T>(work: () => Promise<T>) => {
  const startedAt = Date.now();
  const value = await work();
  return { value, ms: Date.now() - startedAt };
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const evaluateNlu = async (catalog: { departments: string[]; packages: string[]; doctors: string[] }) => {
  if (!live) return blocked("không truyền --nlu");
  if (!aiReady) return blocked("không có GEMINI_API_KEY");
  const latencies: number[] = [];
  const run = async (cases: IntentCase[]) => {
    let correct = 0;
    let entityChecks = 0;
    let entityCorrect = 0;
    const errors: string[] = [];
    for (const item of cases) {
      try {
        const { value, ms } = await timed(() => ChatbotNLUService.extract({ message: item.message, draft: {}, catalog }));
        latencies.push(ms);
        if (value.operation === item.operation) correct += 1;
        else errors.push(`${item.message} → ${value.operation} (đúng: ${item.operation})`);
        for (const [field, expected] of Object.entries(item.entities ?? {})) {
          entityChecks += 1;
          const actual = value.entities[field as keyof typeof value.entities];
          if (typeof actual === "string" && foldVietnamese(actual).includes(foldVietnamese(expected as string))) entityCorrect += 1;
          else errors.push(`${item.message} → ${field}=${JSON.stringify(actual)} (đúng chứa: ${expected})`);
        }
      } catch (error) {
        errors.push(`${item.message} → lỗi gọi AI: ${error instanceof Error ? error.message : "không rõ"}`);
      }
    }
    return { total: cases.length, correct, accuracy: correct / cases.length, entityChecks, entityAccuracy: entityChecks ? entityCorrect / entityChecks : null, errors };
  };
  const tuning = await run(dataset.intents);
  const holdout = await run(dataset.intentsHoldout);

  // Hội thoại nhiều lượt: mỗi lượt nhận lịch sử các lượt trước (giống bộ điều phối), chấm ý định của từng lượt.
  let turnTotal = 0;
  let turnCorrect = 0;
  const turnErrors: string[] = [];
  for (const conversation of dataset.multiTurn) {
    const history: NLUHistoryTurn[] = [];
    for (const turn of conversation.turns) {
      turnTotal += 1;
      try {
        const { value, ms } = await timed(() => ChatbotNLUService.extract({ message: turn.message, draft: {}, catalog, history }));
        latencies.push(ms);
        if (value.operation === turn.operation) turnCorrect += 1;
        else turnErrors.push(`[${conversation.name}] ${turn.message} → ${value.operation} (đúng: ${turn.operation})`);
        history.push({ user: turn.message, operation: value.operation });
      } catch (error) {
        turnErrors.push(`[${conversation.name}] ${turn.message} → lỗi gọi AI: ${error instanceof Error ? error.message : "không rõ"}`);
      }
    }
  }
  return {
    status: "đã đo",
    tuning,
    holdout,
    multiTurn: { total: turnTotal, correct: turnCorrect, accuracy: turnTotal ? turnCorrect / turnTotal : null, errors: turnErrors },
    latencyMs: { calls: latencies.length, p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
  };
};

const evaluateGeneration = async (index: KnowledgeIndex) => {
  if (!live) return blocked("không truyền --nlu");
  if (!aiReady) return blocked("không có GEMINI_API_KEY");
  const results = [];
  for (const item of dataset.generation) {
    const vector = await embedQuery(item.question);
    const chunks = index.search(item.question, { queryVector: vector, limit: K });
    const { value, ms } = await timed(() => answerFromSources({ question: item.question, chunks }).catch(() => null));
    const cited = value ? chunks.filter((chunk) => value.sourceIds.includes(chunk.chunk.id)).map((chunk) => `${chunk.chunk.title} ${chunk.chunk.content}`) : [];
    const numbersOk = value ? numbersAreGrounded(value.reply, cited) : null;
    const answered = Boolean(value) && numbersOk !== false;
    const mentions = (item.mustMention ?? []).every((word) => value && foldVietnamese(value.reply).includes(foldVietnamese(word)));
    results.push({
      name: item.name,
      question: item.question,
      expect: item.expect,
      answered,
      numbersGrounded: numbersOk,
      mentionsExpected: item.mustMention ? mentions : null,
      pass: item.expect === "answer" ? answered && (item.mustMention ? mentions : true) : !answered,
      ms,
      reply: value?.reply ?? null,
      sources: chunks.filter((chunk) => value?.sourceIds.includes(chunk.chunk.id)).map((chunk) => `${chunk.chunk.sourceType}:${chunk.chunk.title}`),
    });
  }
  return { status: "đã đo", passed: results.filter((item) => item.pass).length, total: results.length, results };
};

const main = async () => {
  // Chỉ đọc đoạn tri thức đã lưu (kể cả vector đã nhúng) và tên danh mục; không đồng bộ, không ghi.
  const [rows, departments, packages, doctors] = await Promise.all([
    prisma.chatKnowledgeChunk.findMany({ select: { id: true, sourceType: true, sourceId: true, title: true, content: true, url: true, embedding: true } }),
    prisma.department.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.package.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.doctorProfile.findMany({ where: { isAvailable: true, user: { isActive: true } }, select: { title: true, user: { select: { fullName: true } } } }),
  ]);
  const chunks: KnowledgeChunk[] = rows.map((row) => ({ ...row, sourceType: row.sourceType as KnowledgeSourceType, embedding: row.embedding.length ? row.embedding : null }));
  const index = new KnowledgeIndex(chunks);
  const catalog = {
    departments: departments.map((item) => item.name),
    packages: packages.map((item) => item.name),
    doctors: doctors.map((item) => [item.title, item.user.fullName].filter(Boolean).join(" ")),
  };

  let vectors: Map<string, number[]> | null = null;
  if (aiReady && index.embeddedCount > 0) {
    vectors = new Map();
    for (const item of [...dataset.retrieval, ...dataset.retrievalHoldout]) vectors.set(item.query, await embedQuery(item.query));
  }
  const retrieval = (cases: RetrievalCase[]) => ({
    lexical: evaluateRetrieval(index, chunks, cases, "lexical", vectors),
    semantic: evaluateRetrieval(index, chunks, cases, "semantic", vectors),
    hybrid: evaluateRetrieval(index, chunks, cases, "hybrid", vectors),
  });

  const result = {
    measuredAt: new Date().toISOString(),
    k: K,
    knowledge: { chunks: index.size, embedded: index.embeddedCount },
    router: { tuning: evaluateRouter(dataset.intents), holdout: evaluateRouter(dataset.intentsHoldout) },
    dateTime: evaluateDateTimes(),
    retrieval: { tuning: retrieval(dataset.retrieval), holdout: retrieval(dataset.retrievalHoldout) },
    nlu: await evaluateNlu(catalog),
    generation: await evaluateGeneration(index),
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

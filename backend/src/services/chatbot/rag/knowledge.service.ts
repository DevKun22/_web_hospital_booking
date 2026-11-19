import { prisma } from "../../../config/prisma.js";
import { logger } from "../../../observability/logger.js";
import { contentHash } from "./chunker.js";
import { buildKnowledgeDocs } from "./sources.js";
import { embedDocuments, embedQuery, embeddingModelName, isEmbeddingConfigured } from "./embedder.js";
import { KnowledgeIndex } from "./retriever.js";
import type { KnowledgeChunk, KnowledgeSourceType, RetrievedChunk } from "./rag.types.js";

// Cổng duy nhất vào kho tri thức: đồng bộ từ dữ liệu nghiệp vụ, giữ chỉ mục trong bộ nhớ và truy hồi.

/** Kho tự đồng bộ lại sau khoảng này (dữ liệu nguồn do quản trị sửa), ngoài ra có nút đồng bộ thủ công. */
const AUTO_SYNC_INTERVAL_MS = 10 * 60_000;
/** Chỉ mục trong bộ nhớ được nạp lại từ DB sau khoảng này. */
const INDEX_TTL_MS = 5 * 60_000;

type SyncResult = {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  embedded: number;
  /** Có lỗi khi nhúng: đoạn vẫn được lưu và tìm được theo từ. */
  embeddingError: string | null;
};

type LoadedIndex = { index: KnowledgeIndex; expiresAt: number };

let loaded: LoadedIndex | null = null;
let syncing: Promise<SyncResult> | null = null;
let syncTimer: NodeJS.Timeout | null = null;
let lastSyncAt = 0;

const toChunk = (row: {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  url: string | null;
  embedding: number[];
}): KnowledgeChunk => ({
  id: row.id,
  sourceType: row.sourceType as KnowledgeSourceType,
  sourceId: row.sourceId,
  title: row.title,
  content: row.content,
  url: row.url,
  embedding: row.embedding.length ? row.embedding : null,
});

class KnowledgeService {
  /** Tăng sau mỗi lần đồng bộ: bộ nhớ đệm câu trả lời gắn với phiên bản này sẽ hết hiệu lực. */
  version = 0;

  invalidate() {
    loaded = null;
    this.version += 1;
  }

  private async loadIndex() {
    if (loaded && loaded.expiresAt > Date.now()) return loaded.index;
    const rows = await prisma.chatKnowledgeChunk.findMany({
      select: { id: true, sourceType: true, sourceId: true, title: true, content: true, url: true, embedding: true },
    });
    const index = new KnowledgeIndex(rows.map(toChunk));
    loaded = { index, expiresAt: Date.now() + INDEX_TTL_MS };
    return index;
  }

  /**
   * Đồng bộ kho với dữ liệu nghiệp vụ theo mã băm nội dung: chỉ đoạn mới hoặc đổi mới được nhúng lại,
   * đoạn của bản ghi đã xóa hoặc ngừng hoạt động bị xóa. Gọi đồng thời thì dùng chung một lần chạy.
   */
  sync(): Promise<SyncResult> {
    if (syncing) return syncing;
    syncing = this.runSync().finally(() => {
      syncing = null;
    });
    return syncing;
  }

  /**
   * Đồng bộ sau một khoảng ngắn kể từ lần gọi cuối: quản trị lưu liên tiếp nhiều lần chỉ tốn một lượt đồng bộ, và chatbot biết nội dung
   * vừa sửa ngay thay vì chờ chu kỳ tự đồng bộ. Lỗi chỉ ghi nhật ký, không ảnh hưởng thao tác của quản trị.
   */
  scheduleSync(delayMs = Number(process.env.KNOWLEDGE_SYNC_DELAY_MS) || 5_000) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      void this.sync().catch((error) => logger.warn("[CHATBOT_KB] Không đồng bộ được kho tri thức sau khi nội dung đổi:", error));
    }, delayMs);
    syncTimer.unref?.();
  }

  private async runSync(): Promise<SyncResult> {
    const docs = await buildKnowledgeDocs();
    const existing = await prisma.chatKnowledgeChunk.findMany({
      select: { id: true, sourceType: true, sourceId: true, contentHash: true, embeddingModel: true, embedding: true },
    });
    const byKey = new Map(existing.map((row) => [`${row.sourceType}:${row.sourceId}`, row]));
    const model = embeddingModelName();
    const canEmbed = isEmbeddingConfigured();

    const pending = docs
      .map((doc) => {
        const row = byKey.get(`${doc.sourceType}:${doc.sourceId}`);
        const hash = contentHash(doc);
        const contentChanged = !row || row.contentHash !== hash;
        const needsVector = canEmbed && (!row || !row.embedding.length || row.embeddingModel !== model);
        return { doc, row, hash, contentChanged, needsVector };
      })
      .filter((item) => item.contentChanged || item.needsVector);

    let embeddingError: string | null = null;
    let vectors = new Map<string, number[]>();
    const toEmbed = canEmbed ? pending : [];
    if (toEmbed.length) {
      try {
        const result = await embedDocuments(toEmbed.map((item) => `${item.doc.title}\n${item.doc.content}`));
        vectors = new Map(toEmbed.map((item, index) => [`${item.doc.sourceType}:${item.doc.sourceId}`, result[index]]));
      } catch (error) {
        embeddingError = error instanceof Error ? error.message : "Không nhúng được";
        logger.warn("[CHATBOT_RAG] Không nhúng được đoạn tri thức, chỉ tìm theo từ:", error);
      }
    }

    let created = 0;
    let updated = 0;
    for (const item of pending) {
      const key = `${item.doc.sourceType}:${item.doc.sourceId}`;
      const vector = vectors.get(key);
      // Nội dung đổi mà chưa nhúng lại được thì xóa vector cũ để khỏi so khớp bằng vector lệch nghĩa.
      const embedding = vector ?? (item.contentChanged ? [] : undefined);
      const data = {
        title: item.doc.title,
        content: item.doc.content,
        url: item.doc.url,
        contentHash: item.hash,
        ...(embedding ? { embedding, embeddingModel: vector ? model : null } : {}),
      };
      await prisma.chatKnowledgeChunk.upsert({
        where: { sourceType_sourceId: { sourceType: item.doc.sourceType, sourceId: item.doc.sourceId } },
        create: { sourceType: item.doc.sourceType, sourceId: item.doc.sourceId, embedding: embedding ?? [], ...data },
        update: data,
      });
      if (item.row) updated += 1;
      else created += 1;
    }

    const liveKeys = new Set(docs.map((doc) => `${doc.sourceType}:${doc.sourceId}`));
    const staleIds = existing.filter((row) => !liveKeys.has(`${row.sourceType}:${row.sourceId}`)).map((row) => row.id);
    if (staleIds.length) await prisma.chatKnowledgeChunk.deleteMany({ where: { id: { in: staleIds } } });

    lastSyncAt = Date.now();
    this.invalidate();
    return { total: docs.length, created, updated, deleted: staleIds.length, embedded: vectors.size, embeddingError };
  }

  /** Lần đầu (kho trống) đồng bộ ngay trước khi trả lời; sau đó đồng bộ ngầm theo chu kỳ, không làm chậm câu hỏi. */
  private async ensureFresh() {
    const index = await this.loadIndex();
    if (index.size === 0) {
      await this.sync().catch((error) => logger.warn("[CHATBOT_RAG] Đồng bộ lần đầu lỗi:", error));
      return this.loadIndex();
    }
    if (Date.now() - lastSyncAt > AUTO_SYNC_INTERVAL_MS) {
      lastSyncAt = Date.now();
      void this.sync().catch((error) => logger.warn("[CHATBOT_RAG] Đồng bộ định kỳ lỗi:", error));
    }
    return index;
  }

  async retrieve(
    query: string,
    options: { types?: KnowledgeSourceType[]; limit?: number } = {},
  ): Promise<RetrievedChunk[]> {
    const index = await this.ensureFresh();
    let queryVector: number[] | null = null;
    if (index.embeddedCount > 0 && isEmbeddingConfigured()) {
      try {
        queryVector = await embedQuery(query);
      } catch (error) {
        logger.warn("[CHATBOT_RAG] Không nhúng được câu hỏi, chỉ tìm theo từ:", error);
      }
    }
    return index.search(query, { queryVector, ...options });
  }

  async stats() {
    const [rows, latest] = await Promise.all([
      prisma.chatKnowledgeChunk.findMany({ select: { sourceType: true, sourceId: true } }),
      prisma.chatKnowledgeChunk.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    ]);
    const index = await this.loadIndex();
    // Một nguồn (một bài viết, một bác sĩ...) có thể được cắt thành nhiều đoạn (bài viết cắt theo mục, id nguồn có đuôi #mục):
    // đếm riêng số nguồn và số đoạn để quản trị không nhầm hai con số.
    const byType: Record<string, { sources: number; chunks: number }> = {};
    const seen = new Set<string>();
    for (const row of rows) {
      const entry = (byType[row.sourceType] ??= { sources: 0, chunks: 0 });
      entry.chunks += 1;
      const key = `${row.sourceType}:${row.sourceId.split("#")[0]}`;
      if (!seen.has(key)) {
        seen.add(key);
        entry.sources += 1;
      }
    }
    return {
      total: index.size,
      embedded: index.embeddedCount,
      embeddingConfigured: isEmbeddingConfigured(),
      embeddingModel: embeddingModelName(),
      lastUpdatedAt: latest?.updatedAt ?? null,
      byType,
    };
  }
}

export default new KnowledgeService();

import { foldVietnamese } from "../rules/text-normalizer.js";
import { cosine } from "./embedder.js";
import type { KnowledgeChunk, KnowledgeSourceType, RetrievedChunk } from "./rag.types.js";

// Truy hồi lai: tìm theo từ (BM25) và theo ngữ nghĩa (cosine) rồi trộn thứ hạng bằng RRF.
// Tìm theo từ bắt đúng tên riêng, con số, mã; tìm theo ngữ nghĩa bắt cách diễn đạt khác. Thiếu vector thì chỉ còn tìm theo từ.

const STOPWORDS = new Set([
  "ban", "toi", "minh", "duoc", "khong", "nao", "gi", "vay", "dang", "hien", "tai", "co", "the", "la", "va", "mot",
  "cac", "cho", "nhu", "lam", "thi", "o", "de", "voi", "cua", "nay", "kia", "ma", "nhe", "a", "ha", "hay", "rat", "bi",
  "muon", "can", "xin", "hoi", "biet", "cho", "em", "anh", "chi",
]);

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const RRF_K = 60;
/** Ngưỡng cosine: dưới mức này mà không khớp từ nào thì coi là không liên quan. */
const MIN_SIMILARITY = 0.6;
/** Tỉ lệ từ khóa của câu hỏi phải xuất hiện trong đoạn để coi là liên quan khi chỉ tìm theo từ. */
const MIN_COVERAGE = 0.5;

/** Tách từ: bỏ dấu, bỏ từ đệm, thêm cặp hai từ liền nhau để giữ cụm như "xet nghiem". */
export const tokenize = (text: string) => {
  const words = (foldVietnamese(text).match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 2 && !STOPWORDS.has(word));
  const bigrams = words.slice(1).map((word, index) => `${words[index]}_${word}`);
  return { words, all: [...words, ...bigrams] };
};

type IndexedChunk = { chunk: KnowledgeChunk; terms: Map<string, number>; length: number; wordSet: Set<string> };

export class KnowledgeIndex {
  private readonly docs: IndexedChunk[];
  private readonly docFreq = new Map<string, number>();
  private readonly avgLength: number;

  constructor(chunks: KnowledgeChunk[]) {
    this.docs = chunks.map((chunk) => {
      // Tiêu đề lặp hai lần để tên gói, tên bác sĩ có trọng số cao hơn phần mô tả.
      const { words, all } = tokenize(`${chunk.title} ${chunk.title} ${chunk.content}`);
      const terms = new Map<string, number>();
      for (const term of all) terms.set(term, (terms.get(term) || 0) + 1);
      return { chunk, terms, length: all.length, wordSet: new Set(words) };
    });
    for (const doc of this.docs) {
      for (const term of doc.terms.keys()) this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    }
    this.avgLength = this.docs.reduce((sum, doc) => sum + doc.length, 0) / (this.docs.length || 1);
  }

  get size() {
    return this.docs.length;
  }

  get embeddedCount() {
    return this.docs.filter((doc) => doc.chunk.embedding?.length).length;
  }

  private idf(term: string) {
    const df = this.docFreq.get(term) || 0;
    return Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
  }

  private bm25(queryTerms: string[], doc: IndexedChunk) {
    let score = 0;
    for (const term of new Set(queryTerms)) {
      const frequency = doc.terms.get(term);
      if (!frequency) continue;
      const idf = this.idf(term);
      score += (idf * frequency * (BM25_K1 + 1)) / (frequency + BM25_K1 * (1 - BM25_B + (BM25_B * doc.length) / this.avgLength));
    }
    return score;
  }

  search(
    query: string,
    options: { queryVector?: number[] | null; types?: KnowledgeSourceType[]; limit?: number } = {},
  ): RetrievedChunk[] {
    const { words, all } = tokenize(query);
    if (!all.length && !options.queryVector) return [];
    const wanted = options.types ? new Set<string>(options.types) : null;
    const limit = options.limit ?? 5;
    // Từ không có trong kho (từ đệm như "lâu", "thì") không được tính vào mẫu số; từ hiếm có trọng số cao hơn từ phổ biến.
    const knownWords = words.filter((word) => this.docFreq.has(word));
    const knownWeight = knownWords.reduce((sum, word) => sum + this.idf(word), 0);

    const candidates = this.docs
      .filter((doc) => !wanted || wanted.has(doc.chunk.sourceType))
      .map((doc) => {
        const matchedWords = knownWords.filter((word) => doc.wordSet.has(word));
        const matchedWeight = matchedWords.reduce((sum, word) => sum + this.idf(word), 0);
        return {
          doc,
          lexical: this.bm25(all, doc),
          // Câu từ hai từ trở lên cần khớp ít nhất hai từ: một từ trùng ngẫu nhiên (như "thời" trong "thời hạn") không đủ.
          coverage: knownWeight && matchedWords.length >= Math.min(2, words.length) ? matchedWeight / knownWeight : 0,
          similarity: options.queryVector && doc.chunk.embedding?.length ? cosine(options.queryVector, doc.chunk.embedding) : null,
        };
      });

    const rank = (sort: (a: (typeof candidates)[number]) => number) =>
      new Map(
        [...candidates]
          .filter((candidate) => sort(candidate) > 0)
          .sort((a, b) => sort(b) - sort(a))
          .map((candidate, index) => [candidate.doc.chunk.id, index + 1] as const),
      );
    const lexicalRank = rank((candidate) => candidate.lexical);
    const semanticRank = rank((candidate) => candidate.similarity ?? 0);

    return candidates
      .filter((candidate) => candidate.coverage >= MIN_COVERAGE || (candidate.similarity ?? 0) >= MIN_SIMILARITY)
      .map((candidate) => {
        const id = candidate.doc.chunk.id;
        const lexicalPart = lexicalRank.has(id) ? 1 / (RRF_K + (lexicalRank.get(id) as number)) : 0;
        const semanticPart = semanticRank.has(id) ? 1 / (RRF_K + (semanticRank.get(id) as number)) : 0;
        return {
          chunk: candidate.doc.chunk,
          score: lexicalPart + semanticPart,
          coverage: candidate.coverage,
          similarity: candidate.similarity,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

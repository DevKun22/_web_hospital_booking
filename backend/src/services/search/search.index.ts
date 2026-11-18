import { foldVietnamese } from "../chatbot/rules/text-normalizer.js";
import type { PublicSearchResult, SearchDocumentType } from "./search.types.js";

// Chỉ mục tìm kiếm trong bộ nhớ: chuẩn hóa không dấu bằng foldVietnamese (cùng bộ chuẩn hóa với chatbot) nên "tim mach"
// khớp "Tim mạch". Thuần hàm, không đụng cơ sở dữ liệu: việc nạp dữ liệu nằm ở search.service.

const MAX_BODY_LENGTH = 4_000;

// Điểm nền mỗi loại giữ nguyên như bản trước (tiêu đề khớp cao hơn nội dung khớp) để thứ tự giữa các loại không đổi.
const BASE_SCORE: Record<SearchDocumentType, { title: number; other: number }> = {
  department: { title: 30, other: 15 },
  doctor: { title: 28, other: 14 },
  package: { title: 24, other: 12 },
  faq: { title: 20, other: 10 },
};

export type SearchDocumentInput = {
  result: Omit<PublicSearchResult, "score">;
  // Văn bản dùng để khớp: tiêu đề (trọng số cao nhất), các từ khóa ngắn, và phần thân.
  title: string;
  keywords?: (string | null | undefined)[];
  body?: (string | null | undefined)[];
  scoreBonus?: number;
};

type IndexedDocument = {
  result: Omit<PublicSearchResult, "score">;
  foldedTitle: string;
  foldedHaystack: string;
  baseScore: { title: number; other: number };
  scoreBonus: number;
};

export type SearchIndex = { documents: IndexedDocument[] };

const fold = (value: string | null | undefined) => (value ? foldVietnamese(value) : "");

export const buildSearchIndex = (inputs: SearchDocumentInput[]): SearchIndex => ({
  documents: inputs.map((input) => {
    const foldedTitle = fold(input.title);
    const keywords = (input.keywords ?? []).map(fold).filter(Boolean).join(" ");
    const body = (input.body ?? []).map(fold).filter(Boolean).join(" ").slice(0, MAX_BODY_LENGTH);
    return {
      result: input.result,
      foldedTitle,
      foldedHaystack: [foldedTitle, keywords, body].filter(Boolean).join(" "),
      baseScore: BASE_SCORE[input.result.type],
      scoreBonus: input.scoreBonus ?? 0,
    };
  }),
});

export const querySearchIndex = (
  index: SearchIndex,
  rawQuery: string,
  options: { type: SearchDocumentType | "all"; limit: number },
): PublicSearchResult[] => {
  const query = fold(rawQuery);
  const tokens = query.split(" ").filter(Boolean).slice(0, 10);
  if (tokens.length === 0) return [];

  const scored: PublicSearchResult[] = [];
  for (const document of index.documents) {
    if (options.type !== "all" && document.result.type !== options.type) continue;
    // Mọi từ trong câu hỏi phải xuất hiện (ở tiêu đề, từ khóa hoặc nội dung): "tim mach bac si" không khớp bừa.
    if (!tokens.every((token) => document.foldedHaystack.includes(token))) continue;

    const titleMatches = document.foldedTitle.includes(query);
    let score = (titleMatches ? document.baseScore.title : document.baseScore.other) + document.scoreBonus;
    if (document.foldedTitle.startsWith(query)) score += 3;
    score += tokens.filter((token) => document.foldedTitle.includes(token)).length;
    scored.push({ ...document.result, score });
  }

  return scored
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title, "vi"))
    .slice(0, options.limit);
};

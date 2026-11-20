// Kiểu dùng chung của kho tri thức chatbot (RAG).

const KNOWLEDGE_SOURCE_TYPES = ["FAQ", "DEPARTMENT", "DOCTOR", "PACKAGE", "POLICY", "SITE", "ARTICLE"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

/** Một đoạn tri thức dựng từ dữ liệu nghiệp vụ, chưa nhúng. */
export type KnowledgeDoc = {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  content: string;
  /** Trang gốc trên website; null nếu không có trang riêng. */
  url: string | null;
};

/** Đoạn đã lưu trong kho. `embedding` null khi chưa nhúng được (chỉ tìm theo từ). */
export type KnowledgeChunk = KnowledgeDoc & {
  id: string;
  embedding: number[] | null;
};

export type RetrievedChunk = {
  chunk: KnowledgeChunk;
  /** Điểm xếp hạng sau khi trộn tìm theo từ và theo ngữ nghĩa (RRF). */
  score: number;
  /** Tỉ lệ từ của câu hỏi xuất hiện trong đoạn, 0..1. */
  coverage: number;
  /** Độ giống cosine với câu hỏi; null khi không có vector. */
  similarity: number | null;
};

export type ChatbotSource = {
  id: string;
  type: KnowledgeSourceType;
  title: string;
  url: string | null;
  /** Người duyệt nội dung (nếu có ghi nhận) và ngày cập nhật/duyệt gần nhất (ISO), chỉ có với nguồn là nội dung được duyệt. */
  reviewedBy?: string | null;
  updatedAt?: string;
};

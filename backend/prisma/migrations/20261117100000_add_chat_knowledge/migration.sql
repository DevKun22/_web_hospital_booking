-- Kho tri thức cho chatbot RAG và nguồn trích dẫn trong nhật ký.
ALTER TABLE "ChatbotLog" ADD COLUMN "sourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ChatKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatKnowledgeChunk_sourceType_sourceId_key" ON "ChatKnowledgeChunk"("sourceType", "sourceId");
CREATE INDEX "ChatKnowledgeChunk_sourceType_idx" ON "ChatKnowledgeChunk"("sourceType");

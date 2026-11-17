-- Đường dẫn trang gốc của đoạn tri thức, để chatbot dẫn người dùng tới nguồn.
ALTER TABLE "ChatKnowledgeChunk" ADD COLUMN "url" TEXT;

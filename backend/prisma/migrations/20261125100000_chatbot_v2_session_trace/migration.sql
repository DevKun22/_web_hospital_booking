-- Chatbot V2: thêm cột (không xóa, không đổi dữ liệu cũ).
ALTER TABLE "ChatbotSession" ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ChatbotSession" ADD COLUMN IF NOT EXISTS "pendingAction" JSONB;
ALTER TABLE "ChatbotSession" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChatbotLog" ADD COLUMN IF NOT EXISTS "trace" JSONB;

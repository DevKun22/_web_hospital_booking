-- Phản hồi hữu ích / chưa đúng và cờ "chưa có thông tin" cho nhật ký chatbot.
ALTER TABLE "ChatbotLog" ADD COLUMN "noInformation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatbotLog" ADD COLUMN "feedback" TEXT;
ALTER TABLE "ChatbotLog" ADD COLUMN "feedbackAt" TIMESTAMP(3);

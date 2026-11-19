import type { NextFunction, Request, Response } from "express";
import KnowledgeService from "../services/chatbot/rag/knowledge.service.js";

// Quản trị sửa chuyên khoa, bác sĩ hoặc gói khám thành công (kể cả duyệt hồ sơ bác sĩ) thì lên lịch nạp lại kho tri thức của chatbot.
// Một chỗ duy nhất ở tầng đường dẫn nên không phải nhớ gọi trong từng hàm ghi.
export const syncKnowledgeAfterWrite = (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    res.on("finish", () => {
      if (res.statusCode < 400) KnowledgeService.scheduleSync();
    });
  }
  next();
};

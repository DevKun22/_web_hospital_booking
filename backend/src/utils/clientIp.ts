import type { Request } from "express";

// IP của client theo cấu hình `trust proxy` đã khớp với topology triển khai.
// Không đọc trực tiếp X-Forwarded-For vì client có thể giả header này để né
// giới hạn theo IP khi API chạy không qua reverse proxy.
export const getClientIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || "unknown";

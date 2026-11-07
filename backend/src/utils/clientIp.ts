import type { Request } from "express";

// IP của client theo cấu hình `trust proxy` của Express (chỉ tin một lớp proxy
// phía trước). Không đọc trực tiếp header X-Forwarded-For: giá trị đầu tiên do
// client tự gửi nên có thể đổi để né các giới hạn theo IP.
export const getClientIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || "unknown";

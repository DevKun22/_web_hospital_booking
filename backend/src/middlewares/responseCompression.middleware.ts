import compression from "compression";
import type { Request, Response } from "express";

const shouldCompress = (req: Request, res: Response) => {
  // Tệp tải xuống/proxy đã có định dạng nén hoặc cần được truyền nguyên trạng.
  if (res.getHeader("Content-Disposition")) return false;
  return compression.filter(req, res);
};

export const responseCompression = compression({
  threshold: 1_024,
  filter: shouldCompress,
});

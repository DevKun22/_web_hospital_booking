import { AppError } from "../utils/appError.js";

const DEFAULT_ALLOWED_HOSTS = ["res.cloudinary.com"];

const getAllowedHosts = () =>
  (process.env.MEDICAL_FILE_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

const getMaxBytes = () => {
  const value = Number(process.env.MEDICAL_FILE_MAX_BYTES || 20 * 1024 * 1024);
  return Number.isSafeInteger(value) && value > 0 ? value : 20 * 1024 * 1024;
};

class SecureMedicalFileService {
  async fetch(urlInput: string) {
    let url: URL;
    try {
      url = new URL(urlInput);
    } catch {
      throw new AppError("Nguồn file kết quả không hợp lệ", 422);
    }

    if (
      url.protocol !== "https:" ||
      !getAllowedHosts().includes(url.hostname.toLowerCase())
    ) {
      throw new AppError("Nguồn file kết quả không được phép", 422);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "error",
        headers: { accept: "application/pdf,image/*,application/octet-stream" },
      });

      if (!response.ok) {
        throw new AppError("Không thể tải file kết quả", 502);
      }

      const declaredLength = Number(response.headers.get("content-length") || 0);
      const maxBytes = getMaxBytes();
      if (declaredLength > maxBytes) {
        throw new AppError("File kết quả vượt quá giới hạn cho phép", 413);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) {
        throw new AppError("File kết quả vượt quá giới hạn cho phép", 413);
      }

      return {
        buffer,
        contentType:
          response.headers.get("content-type") || "application/octet-stream",
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Không thể tải file kết quả", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export default new SecureMedicalFileService();

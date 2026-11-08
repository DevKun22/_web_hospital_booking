import { cloudinary } from "../config/cloudinary.js";
import { AppError } from "../utils/appError.js";
import { sniffMedicalFile } from "../utils/fileSignature.js";

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

// Đường dẫn tệp riêng tư của Cloudinary: /<cloud>/raw/authenticated/[s--chữ ký--/]v<phiên bản>/<public_id>
const AUTHENTICATED_RAW_PATH = /^\/[^/]+\/raw\/authenticated\/(?:s--[^/]+--\/)?v(\d+)\/(.+)$/;

// Chỉ nhận đường dẫn https tới máy chủ lưu tệp đã được cho phép, để không lưu hoặc tải từ nơi tùy ý.
export const isAllowedMedicalFileUrl = (urlInput: string) => {
  try {
    const url = new URL(urlInput);
    return url.protocol === "https:" && getAllowedHosts().includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

// Tệp lưu riêng tư không mở được bằng đường dẫn thường: tạo đường dẫn có chữ ký ngay lúc tải,
// chỉ backend (đã xác thực chủ hồ sơ) làm việc này, bệnh nhân không bao giờ nhận đường dẫn gốc.
export const signAuthenticatedMedicalUrl = (url: URL) => {
  const match = url.pathname.match(AUTHENTICATED_RAW_PATH);
  if (!match) return url;
  const [, version, publicId] = match;
  return new URL(
    cloudinary.url(decodeURIComponent(publicId), {
      resource_type: "raw",
      type: "authenticated",
      sign_url: true,
      secure: true,
      version,
    }),
  );
};

class SecureMedicalFileService {
  async fetch(urlInput: string) {
    let url: URL;
    try {
      url = new URL(urlInput);
    } catch {
      throw new AppError("Nguồn file kết quả không hợp lệ", 422);
    }

    if (!isAllowedMedicalFileUrl(urlInput)) {
      throw new AppError("Nguồn file kết quả không được phép", 422);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(signAuthenticatedMedicalUrl(url), {
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

      // Loại tệp lấy từ nội dung thật (tệp riêng tư thường được trả là octet-stream).
      const kind = sniffMedicalFile(buffer);
      return {
        buffer,
        contentType:
          kind?.mime || response.headers.get("content-type") || "application/octet-stream",
        extension: kind?.extension ?? null,
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

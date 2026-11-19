import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

// Điều khoản sử dụng và chính sách bảo mật do cơ sở khám soạn, lưu ở AppSetting (không bịa nội dung mẫu). Văn bản nào có nội dung thì
// được xem là đã cấu hình; riêng điều khoản đã cấu hình thì người khám phải đồng ý trước khi gửi OTP (đăng nhập hoặc đặt lịch).
// Phiên bản = thời điểm lưu gần nhất, nên sửa văn bản là yêu cầu đồng ý lại.

const LEGAL_KEY = "legal_documents";
const CACHE_TTL_MS = 15_000;

export type LegalDocKey = "terms" | "privacy";
export type LegalDoc = { title: string; body: string; version: string; updatedAt: string };
export type LegalDocuments = { terms: LegalDoc | null; privacy: LegalDoc | null };

export const TERMS_REQUIRED_CODE = "TERMS_REQUIRED";
export const TERMS_OUTDATED_CODE = "TERMS_OUTDATED";

const isDoc = (value: unknown): value is LegalDoc =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as LegalDoc).title === "string" &&
  typeof (value as LegalDoc).body === "string" &&
  typeof (value as LegalDoc).version === "string" &&
  typeof (value as LegalDoc).updatedAt === "string";

const normalize = (stored: unknown): LegalDocuments => {
  const record = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const pick = (key: LegalDocKey) => {
    const doc = record[key];
    return isDoc(doc) && doc.body.trim() ? doc : null;
  };
  return { terms: pick("terms"), privacy: pick("privacy") };
};

let cache: { documents: LegalDocuments; expiresAt: number } | null = null;

class LegalService {
  invalidate() {
    cache = null;
  }

  async get(): Promise<LegalDocuments> {
    if (cache && cache.expiresAt > Date.now()) return cache.documents;
    const setting = await prisma.appSetting.findUnique({
      where: { scope_key: { scope: "SITE", key: LEGAL_KEY } },
      select: { value: true, isActive: true },
    });
    const documents = normalize(setting?.isActive ? setting.value : undefined);
    cache = { documents, expiresAt: Date.now() + CACHE_TTL_MS };
    return documents;
  }

  // Quản trị sửa: văn bản để trống nội dung nghĩa là tắt văn bản đó. Mỗi lần lưu tạo phiên bản mới.
  async update(input: Partial<Record<LegalDocKey, { title: string; body: string }>>) {
    const setting = await prisma.appSetting.findUnique({ where: { scope_key: { scope: "SITE", key: LEGAL_KEY } }, select: { value: true } });
    const next: Record<string, unknown> = setting?.value && typeof setting.value === "object" ? { ...(setting.value as Record<string, unknown>) } : {};
    const now = new Date().toISOString();
    for (const key of ["terms", "privacy"] as const) {
      const doc = input[key];
      if (!doc) continue;
      next[key] = { title: doc.title.trim(), body: doc.body.trim(), version: now, updatedAt: now };
    }
    const value = next as Prisma.InputJsonValue;
    await prisma.appSetting.upsert({
      where: { scope_key: { scope: "SITE", key: LEGAL_KEY } },
      create: { scope: "SITE", key: LEGAL_KEY, value, description: "Điều khoản sử dụng và chính sách bảo mật" },
      update: { value, isActive: true },
    });
    this.invalidate();
    return this.get();
  }

  // Điều khoản đã cấu hình thì phải có xác nhận đúng phiên bản hiện hành. Chưa cấu hình thì không đòi gì.
  // Trả về phiên bản đã đồng ý (để ghi nhận) hoặc null khi không áp dụng.
  async assertTermsConsent(input: { termsAccepted?: boolean; termsVersion?: string }): Promise<string | null> {
    const { terms } = await this.get();
    if (!terms) return null;
    if (input.termsAccepted !== true) {
      throw new AppError("Vui lòng đọc và đồng ý Điều khoản sử dụng trước khi tiếp tục.", 400, TERMS_REQUIRED_CODE);
    }
    if (input.termsVersion !== terms.version) {
      throw new AppError("Điều khoản đã được cập nhật. Vui lòng đọc lại và đồng ý để tiếp tục.", 409, TERMS_OUTDATED_CODE);
    }
    return terms.version;
  }
}

export default new LegalService();

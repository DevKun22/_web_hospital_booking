import { prisma } from "../../../config/prisma.js";
import type { KnowledgeSourceType } from "./rag.types.js";

// Thông tin kiểm chứng của nguồn tri thức: ai duyệt và nội dung cập nhật khi nào, đọc thẳng từ dữ liệu nghiệp vụ (cùng nguồn với trang công khai),
// để người khám thấy câu trả lời dựa trên nội dung đã được duyệt. Loại nguồn không có thông tin này (câu hỏi thường gặp, chính sách, liên hệ,
// gói khám) thì không có; không bịa ngày.

export type SourceMeta = { reviewedBy: string | null; updatedAt: string };

export type SourceRef = { type: KnowledgeSourceType; sourceId: string };

/** Mã nguồn có thể kèm "#chỉ số đoạn" (nội dung chuyên khoa, bài viết được tách nhiều đoạn). */
const baseId = (sourceId: string) => sourceId.split("#")[0];

export const sourceMetaKey = (ref: SourceRef) => `${ref.type}:${baseId(ref.sourceId)}`;

const idsOf = (refs: SourceRef[], type: KnowledgeSourceType) => [...new Set(refs.filter((ref) => ref.type === type).map((ref) => baseId(ref.sourceId)))];

/** Tra cứu hàng loạt (mỗi loại một truy vấn); chỉ trả những nguồn có ngày cập nhật. */
export const loadSourceMeta = async (refs: SourceRef[]): Promise<Map<string, SourceMeta>> => {
  const result = new Map<string, SourceMeta>();
  const departmentIds = idsOf(refs, "DEPARTMENT");
  const doctorIds = idsOf(refs, "DOCTOR");
  const articleIds = idsOf(refs, "ARTICLE");

  const [departments, doctors, articles] = await Promise.all([
    departmentIds.length
      ? prisma.department.findMany({
          where: { id: { in: departmentIds }, contentUpdatedAt: { not: null } },
          select: { id: true, contentReviewerName: true, contentUpdatedAt: true },
        })
      : [],
    doctorIds.length
      ? prisma.doctorProfile.findMany({
          where: { id: { in: doctorIds }, profileUpdatedAt: { not: null } },
          select: { id: true, profileReviewerName: true, profileUpdatedAt: true },
        })
      : [],
    articleIds.length
      ? prisma.article.findMany({
          where: { id: { in: articleIds }, reviewedAt: { not: null } },
          select: { id: true, reviewerName: true, reviewedAt: true },
        })
      : [],
  ]);

  for (const item of departments) {
    if (item.contentUpdatedAt) result.set(`DEPARTMENT:${item.id}`, { reviewedBy: item.contentReviewerName, updatedAt: item.contentUpdatedAt.toISOString() });
  }
  for (const item of doctors) {
    if (item.profileUpdatedAt) result.set(`DOCTOR:${item.id}`, { reviewedBy: item.profileReviewerName, updatedAt: item.profileUpdatedAt.toISOString() });
  }
  for (const item of articles) {
    if (item.reviewedAt) result.set(`ARTICLE:${item.id}`, { reviewedBy: item.reviewerName, updatedAt: item.reviewedAt.toISOString() });
  }
  return result;
};

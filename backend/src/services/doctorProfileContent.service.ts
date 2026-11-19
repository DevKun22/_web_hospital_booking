import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { normalizeOptionalString } from "../utils/text.js";
import type { DoctorProfileContent } from "../validations/catalogContent.validation.js";

// Phần giới thiệu công khai của bác sĩ: bác sĩ soạn bản nháp, quản trị duyệt thì mới hiện công khai (ghi người duyệt và ngày cập nhật).
// Quản trị tự sửa thì có hiệu lực ngay, vì chính quản trị là người duyệt.

const contentSelect = {
  bio: true,
  motto: true,
  careerTimeline: true,
  memberships: true,
  expertise: true,
  profileReviewerName: true,
  profileUpdatedAt: true,
  profileDraft: true,
  profileDraftAt: true,
} satisfies Prisma.DoctorProfileSelect;

const hasContent = (input: DoctorProfileContent) =>
  input.bio !== undefined ||
  input.motto !== undefined ||
  input.careerTimeline !== undefined ||
  input.memberships !== undefined ||
  input.expertise !== undefined;

// Dữ liệu ghi thẳng vào hồ sơ khi quản trị tạo hoặc sửa: cột nội dung và dấu "đã duyệt bởi ai, lúc nào".
export const publishedContentData = (input: DoctorProfileContent, reviewerName?: string | null) => ({
  bio: normalizeOptionalString(input.bio),
  motto: normalizeOptionalString(input.motto),
  careerTimeline: input.careerTimeline,
  memberships: input.memberships,
  expertise: input.expertise,
  ...(hasContent(input) ? { profileUpdatedAt: new Date(), profileReviewerName: reviewerName ?? null } : {}),
});

class DoctorProfileContentService {
  private async profileOfUser(userId: string) {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, ...contentSelect } });
    if (!profile) throw new AppError("Tài khoản này chưa có hồ sơ bác sĩ", 404);
    return profile;
  }

  async getMine(userId: string) {
    return this.profileOfUser(userId);
  }

  // Lưu (ghi đè) bản nháp chờ duyệt. Bản nháp là ảnh chụp đầy đủ phần bác sĩ được sửa, nên giao diện luôn gửi cả bộ.
  async saveDraft(userId: string, draft: DoctorProfileContent) {
    const profile = await this.profileOfUser(userId);
    if (!hasContent(draft)) throw new AppError("Chưa có nội dung nào để gửi duyệt", 400);
    return prisma.doctorProfile.update({
      where: { id: profile.id },
      data: { profileDraft: draft as Prisma.InputJsonValue, profileDraftAt: new Date() },
      select: contentSelect,
    });
  }

  async discardDraft(userId: string) {
    const profile = await this.profileOfUser(userId);
    return prisma.doctorProfile.update({
      where: { id: profile.id },
      data: { profileDraft: Prisma.DbNull, profileDraftAt: null },
      select: contentSelect,
    });
  }

  async listPending() {
    return prisma.doctorProfile.findMany({
      where: { profileDraftAt: { not: null } },
      orderBy: { profileDraftAt: "asc" },
      select: { id: true, slug: true, title: true, user: { select: { fullName: true } }, ...contentSelect },
    });
  }

  async approve(profileId: string, reviewerName: string) {
    const profile = await prisma.doctorProfile.findUnique({ where: { id: profileId }, select: { id: true, profileDraft: true } });
    if (!profile) throw new AppError("Không tìm thấy hồ sơ bác sĩ", 404);
    if (!profile.profileDraft) throw new AppError("Không có bản nháp nào chờ duyệt", 409, "NO_PENDING_DRAFT");

    const draft = profile.profileDraft as DoctorProfileContent;
    return prisma.doctorProfile.update({
      where: { id: profileId },
      data: {
        ...publishedContentData(draft, reviewerName),
        profileDraft: Prisma.DbNull,
        profileDraftAt: null,
      },
      select: contentSelect,
    });
  }

  async reject(profileId: string) {
    const profile = await prisma.doctorProfile.findUnique({ where: { id: profileId }, select: { id: true, profileDraft: true } });
    if (!profile) throw new AppError("Không tìm thấy hồ sơ bác sĩ", 404);
    if (!profile.profileDraft) throw new AppError("Không có bản nháp nào chờ duyệt", 409, "NO_PENDING_DRAFT");
    return prisma.doctorProfile.update({
      where: { id: profileId },
      data: { profileDraft: Prisma.DbNull, profileDraftAt: null },
      select: contentSelect,
    });
  }
}

export default new DoctorProfileContentService();

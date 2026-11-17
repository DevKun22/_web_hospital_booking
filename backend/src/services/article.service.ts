import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../observability/logger.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import KnowledgeService from "./chatbot/rag/knowledge.service.js";
import { roleHasAnyPermission } from "./rbac.service.js";

// Bài viết kiến thức sức khỏe, đi qua ba giai đoạn:
//   chờ duyệt  → bác sĩ duyệt nội dung bằng tài khoản của mình (người duyệt không gõ tay, người viết không tự duyệt)
//   đã duyệt   → quản trị xuất bản
//   đã xuất bản → hiện ở /kien-thuc và là nguồn tri thức cho chatbot (đồng bộ ngay khi đổi)
// Sửa nội dung (tiêu đề, tóm tắt, nội dung) thì dấu duyệt bị xóa và bài về bản nháp: thứ người khám đọc luôn là bản đã được duyệt.

/** Bài quá ngắn không đủ làm tài liệu tham khảo. */
const MIN_PUBLISH_CONTENT = 300;

export type ArticleStage = "PENDING_REVIEW" | "READY" | "PUBLISHED";

type Actor = { userId: string; role: string };

type ArticleInput = {
  title?: string;
  slug?: string;
  summary?: string | null;
  content?: string;
  category?: string | null;
  departmentId?: string | null;
};

const blankToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const departmentSelect = { select: { id: true, name: true, slug: true } } as const;

/** Trang công khai không bao giờ thấy mã tài khoản nhân sự. */
const publicListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  category: true,
  authorName: true,
  reviewerName: true,
  reviewedAt: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  department: departmentSelect,
} satisfies Prisma.ArticleSelect;

const publicDetailSelect = { ...publicListSelect, content: true, createdAt: true, departmentId: true } satisfies Prisma.ArticleSelect;

const dashboardListSelect = { ...publicListSelect, authorId: true, reviewedById: true } satisfies Prisma.ArticleSelect;

const dashboardDetailSelect = { ...dashboardListSelect, content: true, createdAt: true, departmentId: true } satisfies Prisma.ArticleSelect;

const stageWhere = (stage?: ArticleStage): Prisma.ArticleWhereInput => {
  if (stage === "PENDING_REVIEW") return { status: "DRAFT", reviewedAt: null };
  if (stage === "READY") return { status: "DRAFT", reviewedAt: { not: null } };
  if (stage === "PUBLISHED") return { status: "PUBLISHED" };
  return {};
};

class ArticleService {
  // ---- Công khai ----

  async listPublic(query: { category?: string; departmentId?: string; search?: string; skip: number; limit: number }) {
    const where: Prisma.ArticleWhereInput = {
      status: "PUBLISHED",
      ...(query.category ? { category: query.category } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.search
        ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { summary: { contains: query.search, mode: "insensitive" } }] }
        : {}),
    };
    const [items, total, categories] = await Promise.all([
      prisma.article.findMany({ where, select: publicListSelect, orderBy: { publishedAt: "desc" }, skip: query.skip, take: query.limit }),
      prisma.article.count({ where }),
      prisma.article.groupBy({ by: ["category"], where: { status: "PUBLISHED", category: { not: null } }, _count: { _all: true } }),
    ]);
    return {
      items,
      total,
      categories: categories.map((row) => ({ name: row.category as string, count: row._count._all })).sort((a, b) => a.name.localeCompare(b.name, "vi")),
    };
  }

  async getPublicBySlug(slug: string) {
    const article = await prisma.article.findFirst({ where: { slug, status: "PUBLISHED" }, select: publicDetailSelect });
    if (!article) throw new AppError("Không tìm thấy bài viết", 404);
    return article;
  }

  // ---- Dashboard ----

  async listDashboard(query: { stage?: ArticleStage; search?: string; skip: number; limit: number }) {
    const where: Prisma.ArticleWhereInput = {
      ...stageWhere(query.stage),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.article.findMany({ where, select: dashboardListSelect, orderBy: { updatedAt: "desc" }, skip: query.skip, take: query.limit }),
      prisma.article.count({ where }),
    ]);
    return { items, total };
  }

  async getById(id: string) {
    const article = await prisma.article.findUnique({ where: { id }, select: dashboardDetailSelect });
    if (!article) throw new AppError("Không tìm thấy bài viết", 404);
    return article;
  }

  async create(input: ArticleInput & { title: string; content: string }, actor: Actor) {
    const slug = await this.uniqueSlug(input.slug || input.title);
    await this.assertDepartment(input.departmentId);
    const author = await prisma.user.findUnique({ where: { id: actor.userId }, select: { fullName: true } });
    const article = await prisma.article.create({
      data: {
        slug,
        title: input.title,
        summary: blankToNull(input.summary),
        content: input.content,
        category: blankToNull(input.category),
        departmentId: input.departmentId || null,
        authorId: actor.userId,
        authorName: author?.fullName ?? null,
      },
      select: dashboardDetailSelect,
    });
    this.refreshKnowledge();
    return article;
  }

  async update(id: string, input: ArticleInput, actor: Actor) {
    const current = await prisma.article.findUnique({
      where: { id },
      select: { status: true, slug: true, title: true, summary: true, content: true, publishedAt: true },
    });
    if (!current) throw new AppError("Không tìm thấy bài viết", 404);
    // Bài đã xuất bản đang hiển thị cho người khám và chatbot: chỉ người có quyền xuất bản sửa được.
    if (current.status === "PUBLISHED" && !(await roleHasAnyPermission(actor.role, ["article.publish"]))) {
      throw new AppError("Bài đã xuất bản chỉ quản trị sửa được. Hãy tạo bài nháp mới hoặc nhờ quản trị.", 403);
    }
    if (input.departmentId !== undefined) await this.assertDepartment(input.departmentId);

    // Đường dẫn khóa sau lần xuất bản đầu: đổi sẽ làm hỏng liên kết đã chia sẻ, kết quả tìm kiếm và nguồn trích của chatbot.
    const wantsNewSlug = input.slug !== undefined && input.slug !== current.slug;
    if (wantsNewSlug && current.publishedAt) {
      throw new AppError("Đường dẫn không đổi được sau khi bài đã xuất bản", 400);
    }
    const slug = wantsNewSlug ? await this.uniqueSlug(input.slug || input.title || current.title, id) : undefined;

    const contentChanged =
      (input.title !== undefined && input.title !== current.title) ||
      (input.content !== undefined && input.content !== current.content) ||
      (input.summary !== undefined && blankToNull(input.summary) !== blankToNull(current.summary));

    const article = await prisma.article.update({
      where: { id },
      data: {
        slug,
        title: input.title,
        summary: input.summary === undefined ? undefined : blankToNull(input.summary),
        content: input.content,
        category: input.category === undefined ? undefined : blankToNull(input.category),
        departmentId: input.departmentId === undefined ? undefined : input.departmentId || null,
        // Nội dung đổi: dấu duyệt không còn đúng, bài đang xuất bản trở về bản nháp chờ duyệt lại.
        ...(contentChanged ? { reviewedById: null, reviewerName: null, reviewedAt: null, status: "DRAFT" as const } : {}),
      },
      select: dashboardDetailSelect,
    });
    if (contentChanged || current.status === "PUBLISHED") this.refreshKnowledge();
    return article;
  }

  /** Bác sĩ duyệt nội dung bằng tài khoản của mình; người viết không tự duyệt bài của mình. */
  async review(id: string, actor: Actor) {
    const article = await prisma.article.findUnique({ where: { id }, select: { authorId: true } });
    if (!article) throw new AppError("Không tìm thấy bài viết", 404);
    if (article.authorId === actor.userId) {
      throw new AppError("Bạn là người viết bài này nên không tự duyệt được. Hãy nhờ bác sĩ khác duyệt.", 403);
    }
    const reviewer = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { fullName: true, doctorProfile: { select: { title: true } } },
    });
    if (!reviewer) throw new AppError("Không tìm thấy tài khoản người duyệt", 404);
    const displayName = [reviewer.doctorProfile?.title, reviewer.fullName].filter(Boolean).join(" ");
    return prisma.article.update({
      where: { id },
      data: { reviewedById: actor.userId, reviewerName: displayName, reviewedAt: new Date() },
      select: dashboardDetailSelect,
    });
  }

  async publish(id: string) {
    const article = await prisma.article.findUnique({ where: { id }, select: { content: true, publishedAt: true, reviewedAt: true } });
    if (!article) throw new AppError("Không tìm thấy bài viết", 404);
    if (!article.reviewedAt) throw new AppError("Bài chưa được bác sĩ duyệt nội dung nên chưa xuất bản được", 400);
    if (article.content.trim().length < MIN_PUBLISH_CONTENT) {
      throw new AppError(`Nội dung cần ít nhất ${MIN_PUBLISH_CONTENT} ký tự mới xuất bản được`, 400);
    }
    const published = await prisma.article.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: article.publishedAt ?? new Date() },
      select: dashboardDetailSelect,
    });
    this.refreshKnowledge();
    return published;
  }

  /** Gỡ khỏi website và chatbot nhưng giữ dấu duyệt: nội dung không đổi nên xuất bản lại được ngay. */
  async unpublish(id: string) {
    const exists = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError("Không tìm thấy bài viết", 404);
    const article = await prisma.article.update({ where: { id }, data: { status: "DRAFT" }, select: dashboardDetailSelect });
    this.refreshKnowledge();
    return article;
  }

  async remove(id: string) {
    const exists = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError("Không tìm thấy bài viết", 404);
    await prisma.article.delete({ where: { id } });
    this.refreshKnowledge();
  }

  // ---- Nội bộ ----

  /** Cập nhật kho tri thức của chatbot ngay (chỉ đoạn đổi mới được nhúng lại); lỗi không làm hỏng thao tác lưu bài. */
  private refreshKnowledge() {
    void KnowledgeService.sync().catch((error) => logger.warn("[ARTICLE] Không đồng bộ được kho tri thức:", error));
  }

  private async assertDepartment(departmentId?: string | null) {
    if (!departmentId) return;
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!department) throw new AppError("Không tìm thấy chuyên khoa", 404);
  }

  /** Slug chưa dùng: thêm -2, -3... nếu trùng (bỏ qua chính bài đang sửa). */
  private async uniqueSlug(source: string, ignoreId?: string) {
    const base = createSlug(source) || "bai-viet";
    for (let suffix = 1; suffix <= 50; suffix += 1) {
      const slug = suffix === 1 ? base : `${base}-${suffix}`;
      const taken = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
      if (!taken || taken.id === ignoreId) return slug;
    }
    throw new AppError("Không tạo được đường dẫn bài viết, hãy đổi tiêu đề", 409);
  }
}

export default new ArticleService();

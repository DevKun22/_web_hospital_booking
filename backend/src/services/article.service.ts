import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../observability/logger.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import KnowledgeService from "./chatbot/rag/knowledge.service.js";
import { roleHasAnyPermission } from "./rbac.service.js";

// Bài viết kiến thức sức khỏe. Người viết (quản trị, nhân viên, bác sĩ) lưu bản nháp; chỉ quản trị xuất bản, và phải ghi người
// duyệt nội dung chuyên môn. Bài đã xuất bản hiện ở /kien-thuc và là nguồn tri thức cho chatbot (đồng bộ ngay khi đổi).

/** Bài quá ngắn không đủ làm tài liệu tham khảo. */
const MIN_PUBLISH_CONTENT = 300;

type Actor = { userId: string; role: string };

type ArticleInput = {
  title?: string;
  slug?: string;
  summary?: string | null;
  content?: string;
  category?: string | null;
  departmentId?: string | null;
  authorName?: string | null;
  reviewerName?: string | null;
};

const blankToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const listSelect = {
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
  department: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ArticleSelect;

const detailSelect = { ...listSelect, content: true, createdAt: true, departmentId: true } satisfies Prisma.ArticleSelect;

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
      prisma.article.findMany({ where, select: listSelect, orderBy: { publishedAt: "desc" }, skip: query.skip, take: query.limit }),
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
    const article = await prisma.article.findFirst({ where: { slug, status: "PUBLISHED" }, select: detailSelect });
    if (!article) throw new AppError("Không tìm thấy bài viết", 404);
    return article;
  }

  // ---- Dashboard ----

  async listDashboard(query: { status?: "DRAFT" | "PUBLISHED"; search?: string; skip: number; limit: number }) {
    const where: Prisma.ArticleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.article.findMany({ where, select: listSelect, orderBy: { updatedAt: "desc" }, skip: query.skip, take: query.limit }),
      prisma.article.count({ where }),
    ]);
    return { items, total };
  }

  async getById(id: string) {
    const article = await prisma.article.findUnique({ where: { id }, select: detailSelect });
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
        authorName: blankToNull(input.authorName) ?? blankToNull(author?.fullName),
        reviewerName: blankToNull(input.reviewerName),
      },
      select: detailSelect,
    });
    this.refreshKnowledge();
    return article;
  }

  async update(id: string, input: ArticleInput, actor: Actor) {
    const current = await prisma.article.findUnique({ where: { id }, select: { status: true, slug: true, title: true } });
    if (!current) throw new AppError("Không tìm thấy bài viết", 404);
    // Bài đã xuất bản đang hiển thị cho người khám và chatbot: chỉ người có quyền xuất bản mới sửa được.
    if (current.status === "PUBLISHED" && !(await roleHasAnyPermission(actor.role, ["article.publish"]))) {
      throw new AppError("Bài đã xuất bản chỉ quản trị sửa được. Hãy tạo bản nháp mới hoặc nhờ quản trị.", 403);
    }
    if (input.departmentId !== undefined) await this.assertDepartment(input.departmentId);

    const slug = input.slug !== undefined && input.slug !== current.slug ? await this.uniqueSlug(input.slug || current.title, id) : undefined;
    const article = await prisma.article.update({
      where: { id },
      data: {
        slug,
        title: input.title,
        summary: input.summary === undefined ? undefined : blankToNull(input.summary),
        content: input.content,
        category: input.category === undefined ? undefined : blankToNull(input.category),
        departmentId: input.departmentId === undefined ? undefined : input.departmentId || null,
        authorName: input.authorName === undefined ? undefined : blankToNull(input.authorName),
        reviewerName: input.reviewerName === undefined ? undefined : blankToNull(input.reviewerName),
      },
      select: detailSelect,
    });
    this.refreshKnowledge();
    return article;
  }

  async publish(id: string, reviewerName: string) {
    const article = await prisma.article.findUnique({ where: { id }, select: { content: true, publishedAt: true } });
    if (!article) throw new AppError("Không tìm thấy bài viết", 404);
    if (article.content.trim().length < MIN_PUBLISH_CONTENT) {
      throw new AppError(`Nội dung cần ít nhất ${MIN_PUBLISH_CONTENT} ký tự mới xuất bản được`, 400);
    }
    const published = await prisma.article.update({
      where: { id },
      data: { status: "PUBLISHED", reviewerName, reviewedAt: new Date(), publishedAt: article.publishedAt ?? new Date() },
      select: detailSelect,
    });
    this.refreshKnowledge();
    return published;
  }

  async unpublish(id: string) {
    const exists = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError("Không tìm thấy bài viết", 404);
    const article = await prisma.article.update({ where: { id }, data: { status: "DRAFT" }, select: detailSelect });
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

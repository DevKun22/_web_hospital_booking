import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

// Một nguồn FAQ cho trang Hỏi đáp (showOnWeb) và trợ lý ảo (useInChatbot).
type FAQInput = {
  question?: string;
  answer?: string;
  category?: string | null;
  keywords?: string[];
  order?: number;
  showOnWeb?: boolean;
  useInChatbot?: boolean;
  isActive?: boolean;
};

const publicFAQSelect = {
  id: true,
  question: true,
  answer: true,
  category: true,
  order: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FAQSelect;

const dashboardFAQSelect = {
  ...publicFAQSelect,
  keywords: true,
  showOnWeb: true,
  useInChatbot: true,
} satisfies Prisma.FAQSelect;

const normalizeKeywords = (keywords?: string[]) =>
  keywords === undefined
    ? undefined
    : Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)));

class FAQService {
  async listPublic(query: { category?: string }) {
    return prisma.fAQ.findMany({
      where: { category: query.category, isActive: true, showOnWeb: true },
      select: publicFAQSelect,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  async listForChatbot() {
    return prisma.fAQ.findMany({
      where: { isActive: true, useInChatbot: true },
      select: { id: true, question: true, answer: true, keywords: true },
      orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
      // FAQ là kho tri thức nhỏ do quản trị viên biên soạn.
      take: 200,
    });
  }

  async listDashboard(query: { category?: string; isActive?: boolean }) {
    return prisma.fAQ.findMany({
      where: { category: query.category, isActive: query.isActive },
      select: dashboardFAQSelect,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  async getById(id: string) {
    const faq = await prisma.fAQ.findUnique({
      where: { id },
      select: dashboardFAQSelect,
    });
    if (!faq) throw new AppError("Không tìm thấy FAQ", 404);
    return faq;
  }

  async create(
    input: Required<Pick<FAQInput, "question" | "answer">> & FAQInput,
  ) {
    return prisma.fAQ.create({
      data: {
        question: input.question,
        answer: input.answer,
        category: input.category,
        keywords: normalizeKeywords(input.keywords) ?? [],
        order: input.order || 0,
        showOnWeb: input.showOnWeb ?? true,
        useInChatbot: input.useInChatbot ?? true,
        isActive: input.isActive ?? true,
      },
      select: dashboardFAQSelect,
    });
  }

  async update(id: string, input: FAQInput) {
    await this.getById(id);
    return prisma.fAQ.update({
      where: { id },
      data: {
        question: input.question,
        answer: input.answer,
        category: input.category,
        keywords: normalizeKeywords(input.keywords),
        order: input.order,
        showOnWeb: input.showOnWeb,
        useInChatbot: input.useInChatbot,
        isActive: input.isActive,
      },
      select: dashboardFAQSelect,
    });
  }

  async delete(id: string) {
    const faq = await this.getById(id);
    await prisma.fAQ.delete({ where: { id } });
    return faq;
  }
}

export default new FAQService();

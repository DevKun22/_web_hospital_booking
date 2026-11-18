import { prisma } from "../../config/prisma.js";
import { getRuntimeConfig } from "../../config/runtimeConfig.js";
import { logger } from "../../observability/logger.js";
import { buildSearchIndex, querySearchIndex, type SearchDocumentInput, type SearchIndex } from "./search.index.js";
import type { PublicSearchQuery, PublicSearchResult, SearchDocumentType } from "./search.types.js";
import { SEARCH_DOCUMENT_TYPES } from "./search.types.js";
import { resolveSupportSearchUrl } from "./search.urls.js";

const normalizeLimit = (limit?: number) => Math.min(Math.max(limit || 12, 1), 30);

const normalizeQuery = (value?: string) => (value || "").replace(/\s+/g, " ").trim().slice(0, 120);

const normalizeType = (type?: string): SearchDocumentType | "all" =>
  SEARCH_DOCUMENT_TYPES.includes(type as SearchDocumentType) ? (type as SearchDocumentType) : "all";

// `source` giữ giá trị "postgres" để không đổi hợp đồng API: dữ liệu vẫn từ cơ sở dữ liệu, chỉ khớp qua chỉ mục bộ nhớ.
type SearchResponse = {
  items: PublicSearchResult[];
  source: "empty" | "postgres";
};

class PublicSearchService {
  private index: SearchIndex | null = null;
  private expiresAt = 0;
  private building: Promise<SearchIndex> | null = null;

  // Quản trị sửa nội dung thì đánh dấu hết hạn để lần tìm kế tiếp dựng lại ngay (còn lại làm mới theo TTL).
  invalidateIndex() {
    this.expiresAt = 0;
  }

  async search(query: PublicSearchQuery): Promise<SearchResponse> {
    const q = normalizeQuery(query.q);
    if (q.length < 2) return { items: [], source: "empty" };

    const index = await this.getIndex();
    return {
      items: querySearchIndex(index, q, { type: normalizeType(query.type), limit: normalizeLimit(query.limit) }),
      source: "postgres",
    };
  }

  private async getIndex(): Promise<SearchIndex> {
    if (this.index && Date.now() < this.expiresAt) return this.index;
    // Nhiều yêu cầu cùng lúc dùng chung một lần dựng.
    this.building ??= this.loadIndex().finally(() => {
      this.building = null;
    });

    try {
      return await this.building;
    } catch (error) {
      // Cơ sở dữ liệu lỗi thoáng qua thì vẫn phục vụ chỉ mục cũ thay vì làm hỏng tìm kiếm.
      if (this.index) {
        logger.error("[SEARCH_INDEX] rebuild failed, serving the previous index:", error);
        this.expiresAt = Date.now() + 10_000;
        return this.index;
      }
      throw error;
    }
  }

  private async loadIndex(): Promise<SearchIndex> {
    const [departments, doctors, packages, faqs] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          triageDescription: true,
          symptomKeywords: true,
          image: true,
        },
      }),
      prisma.doctorProfile.findMany({
        where: { isAvailable: true, user: { isActive: true }, department: { isActive: true } },
        select: {
          id: true,
          slug: true,
          title: true,
          bio: true,
          specialization: true,
          consultationFee: true,
          user: { select: { fullName: true, avatar: true } },
          department: { select: { name: true } },
        },
      }),
      prisma.package.findMany({
        where: { isActive: true, department: { isActive: true } },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          summary: true,
          basePrice: true,
          serviceFee: true,
          isPopular: true,
          department: { select: { name: true } },
          items: { select: { name: true, price: true, included: true } },
        },
      }),
      prisma.fAQ.findMany({
        where: { isActive: true, showOnWeb: true },
        select: { id: true, question: true, answer: true, category: true, keywords: true },
      }),
    ]);

    const documents: SearchDocumentInput[] = [
      ...departments.map(
        (item): SearchDocumentInput => ({
          result: {
            id: item.id,
            type: "department",
            title: item.name,
            description: item.triageDescription || item.description,
            url: item.slug ? `/chuyen-khoa/${item.slug}` : "/chuyen-khoa",
            image: item.image,
            source: "postgres",
          },
          title: item.name,
          keywords: [item.slug, ...item.symptomKeywords],
          body: [item.description, item.triageDescription],
        }),
      ),
      ...doctors.map(
        (item): SearchDocumentInput => {
          const title = [item.title, item.user.fullName].filter(Boolean).join(" ");
          return {
            result: {
              id: item.id,
              type: "doctor",
              title,
              description: item.bio || item.specialization,
              url: `/bac-si/${item.slug}`,
              image: item.user.avatar,
              departmentName: item.department.name,
              price: item.consultationFee,
              source: "postgres",
            },
            title,
            keywords: [item.specialization, item.department.name],
            body: [item.bio],
          };
        },
      ),
      ...packages.map((item): SearchDocumentInput => {
        const includedItemsTotal = item.items
          .filter((packageItem) => packageItem.included)
          .reduce((total, packageItem) => total + packageItem.price, 0);
        return {
          result: {
            id: item.id,
            type: "package",
            title: item.name,
            description: item.summary || item.description,
            url: item.slug ? `/goi-kham/${item.slug}` : "/goi-kham",
            departmentName: item.department?.name,
            price: (includedItemsTotal || item.basePrice) + item.serviceFee,
            source: "postgres",
          },
          title: item.name,
          keywords: [item.slug, item.department?.name, ...item.items.map((packageItem) => packageItem.name)],
          body: [item.summary, item.description],
          scoreBonus: item.isPopular ? 5 : 0,
        };
      }),
      ...faqs.map(
        (item): SearchDocumentInput => ({
          result: {
            id: item.id,
            type: "faq",
            title: item.question,
            description: item.answer,
            url: item.category
              ? `/hoi-dap?category=${encodeURIComponent(item.category)}`
              : resolveSupportSearchUrl({ title: item.question, description: item.answer, fallback: "/hoi-dap" }),
            source: "postgres",
          },
          title: item.question,
          keywords: [item.category, ...item.keywords],
          body: [item.answer],
        }),
      ),
    ];

    const index = buildSearchIndex(documents);
    this.index = index;
    this.expiresAt = Date.now() + getRuntimeConfig().publicSearch.indexTtlMs;
    return index;
  }
}

export default new PublicSearchService();

import {
  elasticClient,
  elasticsearchIndex,
  isElasticsearchEnabled,
} from "../../config/elasticsearch.js";
import { prisma } from "../../config/prisma.js";
import type {
  PublicSearchQuery,
  PublicSearchResult,
  SearchDocument,
  SearchDocumentType,
} from "./search.types.js";
import { SEARCH_DOCUMENT_TYPES } from "./search.types.js";
import { resolveSupportSearchUrl } from "./search.urls.js";

const normalizeLimit = (limit?: number) =>
  Math.min(Math.max(limit || 12, 1), 30);

const normalizeQuery = (value?: string) =>
  (value || "").replace(/\s+/g, " ").trim().slice(0, 120);

const normalizeType = (type?: string): SearchDocumentType | "all" =>
  SEARCH_DOCUMENT_TYPES.includes(type as SearchDocumentType)
    ? (type as SearchDocumentType)
    : "all";

const toResult = (
  document: SearchDocument,
  source: PublicSearchResult["source"],
  score?: number,
): PublicSearchResult => ({
  id: document.id,
  type: document.type,
  title: document.title,
  description: document.description,
  url: document.url,
  image: document.image,
  departmentName: document.departmentName,
  price: document.price ?? undefined,
  score,
  source,
});

const includesText = (value: string | null | undefined, query: string) =>
  value?.toLowerCase().includes(query.toLowerCase()) || false;

type SearchResponse = {
  items: PublicSearchResult[];
  source: "empty" | "elasticsearch" | "postgres";
};

const rawSearchCacheTtl = Number(process.env.PUBLIC_SEARCH_CACHE_TTL_MS || 30000);
const searchCacheTtlMs = Number.isFinite(rawSearchCacheTtl)
  ? Math.min(Math.max(rawSearchCacheTtl, 0), 5 * 60 * 1000)
  : 30000;
const searchCache = new Map<string, { expiresAt: number; data: SearchResponse }>();

const makeSearchCacheKey = (input: {
  q: string;
  type: SearchDocumentType | "all";
  limit: number;
}) => `${input.type}:${input.limit}:${input.q.toLowerCase()}`;

const cloneSearchResponse = (data: SearchResponse): SearchResponse => ({
  source: data.source,
  items: data.items.map((item) => ({ ...item })),
});

const readSearchCache = (key: string) => {
  if (!searchCacheTtlMs) return null;

  const cached = searchCache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }

  return cloneSearchResponse(cached.data);
};

const writeSearchCache = (key: string, data: SearchResponse) => {
  if (!searchCacheTtlMs) return;

  if (searchCache.size > 200) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }

  searchCache.set(key, {
    expiresAt: Date.now() + searchCacheTtlMs,
    data: cloneSearchResponse(data),
  });
};

const rawElasticsearchQueryTimeout = Number(
  process.env.PUBLIC_SEARCH_ES_QUERY_TIMEOUT_MS || 450,
);
const elasticsearchQueryTimeoutMs = Number.isFinite(rawElasticsearchQueryTimeout)
  ? Math.min(Math.max(rawElasticsearchQueryTimeout, 200), 3000)
  : 450;

const searchSourceFields: Array<keyof SearchDocument> = [
  "id",
  "type",
  "title",
  "description",
  "url",
  "image",
  "departmentName",
  "price",
];

const rawElasticsearchCooldown = Number(
  process.env.PUBLIC_SEARCH_ES_COOLDOWN_MS || 30000,
);
const elasticsearchCooldownMs = Number.isFinite(rawElasticsearchCooldown)
  ? Math.min(Math.max(rawElasticsearchCooldown, 0), 5 * 60 * 1000)
  : 30000;

let elasticsearchUnavailableUntil = 0;

const canUseElasticsearch = () => Date.now() >= elasticsearchUnavailableUntil;

const markElasticsearchUnavailable = () => {
  if (!elasticsearchCooldownMs) return;
  elasticsearchUnavailableUntil = Date.now() + elasticsearchCooldownMs;
};

const withElasticsearchDeadline = <T>(task: Promise<T>) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Elasticsearch search exceeded ${elasticsearchQueryTimeoutMs}ms`));
    }, elasticsearchQueryTimeoutMs);

    task
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });

class PublicSearchService {
  async search(query: PublicSearchQuery): Promise<SearchResponse> {
    const q = normalizeQuery(query.q);
    const type = normalizeType(query.type);
    const limit = normalizeLimit(query.limit);

    if (q.length < 2) {
      return {
        items: [],
        source: "empty" as const,
      };
    }

    const cacheKey = makeSearchCacheKey({ q, type, limit });
    const cached = readSearchCache(cacheKey);
    if (cached) return cached;

    if (isElasticsearchEnabled && elasticClient && canUseElasticsearch()) {
      try {
        const result: SearchResponse = {
          items: await withElasticsearchDeadline(this.searchElasticsearch({ q, type, limit })),
          source: "elasticsearch" as const,
        };
        writeSearchCache(cacheKey, result);
        return result;
      } catch (error) {
        markElasticsearchUnavailable();
        console.warn(
          "[ELASTICSEARCH] Search failed, using PostgreSQL cooldown fallback",
          error,
        );
      }
    }

    const result: SearchResponse = {
      items: await this.searchPostgres({ q, type, limit }),
      source: "postgres" as const,
    };
    writeSearchCache(cacheKey, result);
    return result;
  }

  private async searchElasticsearch(input: {
    q: string;
    type: SearchDocumentType | "all";
    limit: number;
  }) {
    const filters: Record<string, unknown>[] = [{ term: { isActive: true } }];

    if (input.type !== "all") {
      filters.push({ term: { type: input.type } });
    }

    const response = await elasticClient!.search<SearchDocument>({
      index: elasticsearchIndex,
      size: input.limit,
      _source: searchSourceFields,
      track_total_hits: false,
      timeout: `${elasticsearchQueryTimeoutMs}ms`,
      query: {
        bool: {
          filter: filters,
          should: [
            {
              match_phrase: {
                title: {
                  query: input.q,
                  boost: 7,
                },
              },
            },
            {
              match_phrase: {
                departmentName: {
                  query: input.q,
                  boost: 4,
                },
              },
            },
            {
              multi_match: {
                query: input.q,
                type: "phrase_prefix",
                fields: ["title^5", "departmentName^3", "keywords^2"],
                max_expansions: 20,
                boost: 2,
              },
            },
            {
              multi_match: {
                query: input.q,
                fields: [
                  "title^4",
                  "departmentName^2.5",
                  "keywords^2",
                  "description",
                ],
                fuzziness: "AUTO",
                prefix_length: 2,
                max_expansions: 20,
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [
        { _score: "desc" },
        { priority: { order: "desc", missing: "_last" } },
        { updatedAt: { order: "desc", missing: "_last" } },
      ] as any,
    });

    return response.hits.hits
      .map((hit) =>
        hit._source
          ? toResult(hit._source, "elasticsearch", hit._score ?? undefined)
          : null,
      )
      .filter(Boolean) as PublicSearchResult[];
  }

  private async searchPostgres(input: {
    q: string;
    type: SearchDocumentType | "all";
    limit: number;
  }) {
    const take = input.limit;
    const search = input.q;
    const tasks: Promise<PublicSearchResult[]>[] = [];

    if (input.type === "all" || input.type === "department") {
      tasks.push(this.searchDepartments(search, take));
    }

    if (input.type === "all" || input.type === "doctor") {
      tasks.push(this.searchDoctors(search, take));
    }

    if (input.type === "all" || input.type === "package") {
      tasks.push(this.searchPackages(search, take));
    }

    if (input.type === "all" || input.type === "faq") {
      tasks.push(this.searchFAQs(search, take));
    }

    if (input.type === "all" || input.type === "chatbot_faq") {
      tasks.push(this.searchChatbotFAQs(search, take));
    }

    const groups = await Promise.all(tasks);

    return groups
      .flat()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, take);
  }

  private async searchDepartments(search: string, take: number) {
    const searchTokens = search
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .slice(0, 10);
    const items = await prisma.department.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { triageDescription: { contains: search, mode: "insensitive" } },
          { symptomKeywords: { has: search } },
          ...searchTokens.flatMap((token) => [
            { description: { contains: token, mode: "insensitive" as const } },
            {
              triageDescription: {
                contains: token,
                mode: "insensitive" as const,
              },
            },
            { symptomKeywords: { has: token } },
          ]),
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        triageDescription: true,
        symptomKeywords: true,
        image: true,
      },
      take,
      orderBy: { name: "asc" },
    });

    return items.map(
      (item): PublicSearchResult => ({
        id: item.id,
        type: "department",
        title: item.name,
        description: item.triageDescription || item.description,
        url: item.slug ? `/departments/${item.slug}` : "/departments",
        image: item.image,
        score: includesText(item.name, search) ? 30 : 15,
        source: "postgres",
      }),
    );
  }

  private async searchDoctors(search: string, take: number) {
    const items = await prisma.doctorProfile.findMany({
      where: {
        isAvailable: true,
        user: { isActive: true },
        department: { isActive: true },
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { specialization: { contains: search, mode: "insensitive" } },
          { bio: { contains: search, mode: "insensitive" } },
          { user: { fullName: { contains: search, mode: "insensitive" } } },
          { department: { name: { contains: search, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        bio: true,
        specialization: true,
        consultationFee: true,
        user: { select: { fullName: true, avatar: true } },
        department: { select: { name: true } },
      },
      take,
      orderBy: { user: { fullName: "asc" } },
    });

    return items.map(
      (item): PublicSearchResult => ({
        id: item.id,
        type: "doctor",
        title: [item.title, item.user.fullName].filter(Boolean).join(" "),
        description: item.bio || item.specialization,
        url: `/doctors/${item.id}`,
        image: item.user.avatar,
        departmentName: item.department.name,
        price: item.consultationFee,
        score: includesText(item.user.fullName, search) ? 28 : 14,
        source: "postgres",
      }),
    );
  }

  private async searchPackages(search: string, take: number) {
    const items = await prisma.package.findMany({
      where: {
        isActive: true,
        department: { isActive: true },
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { summary: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { department: { name: { contains: search, mode: "insensitive" } } },
          {
            items: {
              some: { name: { contains: search, mode: "insensitive" } },
            },
          },
        ],
      },
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
        items: { select: { price: true, included: true } },
      },
      take,
      orderBy: [{ isPopular: "desc" }, { basePrice: "asc" }],
    });

    return items.map((item): PublicSearchResult => {
      const includedItemsTotal = item.items
        .filter((packageItem) => packageItem.included)
        .reduce((total, packageItem) => total + packageItem.price, 0);
      const finalPrice =
        (includedItemsTotal || item.basePrice) + item.serviceFee;

      return {
        id: item.id,
        type: "package",
        title: item.name,
        description: item.summary || item.description,
        url: item.slug ? `/packages/${item.slug}` : "/packages",
        departmentName: item.department?.name,
        price: finalPrice,
        score:
          (item.isPopular ? 5 : 0) +
          (includesText(item.name, search) ? 24 : 12),
        source: "postgres",
      };
    });
  }

  private async searchFAQs(search: string, take: number) {
    const items = await prisma.publicFAQ.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: search, mode: "insensitive" } },
          { answer: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
      },
      take,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return items.map(
      (item): PublicSearchResult => ({
        id: item.id,
        type: "faq",
        title: item.question,
        description: item.answer,
        url: item.category
          ? `/faqs?category=${encodeURIComponent(item.category)}`
          : resolveSupportSearchUrl({
              title: item.question,
              description: item.answer,
              fallback: "/faqs",
            }),
        score: includesText(item.question, search) ? 20 : 10,
        source: "postgres",
      }),
    );
  }

  private async searchChatbotFAQs(search: string, take: number) {
    const items = await prisma.chatbotFAQ.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: search, mode: "insensitive" } },
          { answer: { contains: search, mode: "insensitive" } },
          { keywords: { has: search } },
        ],
      },
      select: {
        id: true,
        question: true,
        answer: true,
        keywords: true,
      },
      take,
      orderBy: { updatedAt: "desc" },
    });

    return items.map(
      (item): PublicSearchResult => ({
        id: item.id,
        type: "chatbot_faq",
        title: item.question,
        description: item.answer,
        url: resolveSupportSearchUrl({
          title: item.question,
          description: item.answer,
          keywords: item.keywords,
        }),
        score: includesText(item.question, search) ? 18 : 8,
        source: "postgres",
      }),
    );
  }
}

export default new PublicSearchService();

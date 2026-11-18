import { Prisma } from "../../../generated/prisma/client.js";
import { databaseSchema, prisma } from "../../config/prisma.js";
import { logger } from "../../observability/logger.js";
import { parseSearchText } from "./search.query.js";
import type { PublicSearchQuery, PublicSearchResult, SearchDocumentType } from "./search.types.js";
import { SEARCH_DOCUMENT_TYPES } from "./search.types.js";
import { resolveSupportSearchUrl } from "./search.urls.js";

// Tìm kiếm công khai bằng full-text của Postgres trên view vật chất "SearchDocument" (xem migration search_document_view):
// chỉ mục GIN cho tsvector (khớp từ, tiền tố, xếp hạng theo trọng số) và chỉ mục trigram cho lỗi gõ sai.
// Khác bản chỉ mục trong bộ nhớ: không tốn RAM của API, không treo luồng chính, mọi instance thấy cùng kết quả.
const searchDocumentTable = Prisma.raw(`"${databaseSchema}"."SearchDocument"`);

const REFRESH_DEBOUNCE_MS = 2_000;
const MIN_FUZZY_LENGTH = 3;
// Khớp gần đúng chỉ dành cho truy vấn ngắn (lỗi gõ sai thường gặp ở đó); câu dài mà không khớp từ nào thì trigram chỉ trả
// về nhiễu nên trả rỗng.
const MAX_FUZZY_TOKENS = 3;

const normalizeLimit = (limit?: number) => Math.min(Math.max(limit || 12, 1), 30);

const normalizeQuery = (value?: string) => (value || "").replace(/\s+/g, " ").trim().slice(0, 120);

const normalizeType = (type?: string): SearchDocumentType | "all" =>
  SEARCH_DOCUMENT_TYPES.includes(type as SearchDocumentType) ? (type as SearchDocumentType) : "all";

// `source` giữ giá trị "postgres" để không đổi hợp đồng API.
type SearchResponse = {
  items: PublicSearchResult[];
  source: "empty" | "postgres";
};

type SearchRow = {
  type: SearchDocumentType;
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  category: string | null;
  image: string | null;
  departmentName: string | null;
  price: number | null;
  score: number | string;
};

const toResult = (row: SearchRow): PublicSearchResult => {
  const base = {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    score: Number(row.score),
    source: "postgres" as const,
  };

  switch (row.type) {
    case "department":
      return { ...base, url: row.slug ? `/chuyen-khoa/${row.slug}` : "/chuyen-khoa", image: row.image };
    case "doctor":
      return {
        ...base,
        url: `/bac-si/${row.slug}`,
        image: row.image,
        departmentName: row.departmentName,
        price: row.price,
      };
    case "package":
      return {
        ...base,
        url: row.slug ? `/goi-kham/${row.slug}` : "/goi-kham",
        departmentName: row.departmentName,
        price: row.price,
      };
    default:
      return {
        ...base,
        url: row.category
          ? `/hoi-dap?category=${encodeURIComponent(row.category)}`
          : resolveSupportSearchUrl({ title: row.title, description: row.description, fallback: "/hoi-dap" }),
      };
  }
};

class PublicSearchService {
  private refreshing: Promise<void> | null = null;
  private refreshedOnce = false;
  private dirty = false;
  private debounce: NodeJS.Timeout | null = null;

  // Làm mới view vật chất không khóa đọc (CONCURRENTLY). Nhiều lời gọi cùng lúc dùng chung một lần chạy; nếu có thay đổi
  // đến trong lúc đang chạy thì chạy thêm một lần nữa ngay sau đó.
  async refresh(): Promise<void> {
    if (this.refreshing) {
      this.dirty = true;
      return this.refreshing;
    }

    this.dirty = false;
    this.refreshing = prisma
      .$executeRaw(Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${searchDocumentTable}`)
      .then(() => {
        this.refreshedOnce = true;
      })
      .finally(() => {
        this.refreshing = null;
      });

    await this.refreshing;
    if (this.dirty) await this.refresh();
  }

  // Quản trị sửa nội dung công khai: làm mới ở nền sau một khoảng ngắn (gộp nhiều thao tác sửa liên tiếp).
  invalidateIndex() {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = null;
      this.refresh().catch((error) => logger.error("[SEARCH_INDEX] refresh failed:", error));
    }, REFRESH_DEBOUNCE_MS);
    this.debounce.unref?.();
  }

  async search(query: PublicSearchQuery): Promise<SearchResponse> {
    const q = normalizeQuery(query.q);
    if (q.length < 2) return { items: [], source: "empty" };

    const { tokens, phrase, tsQuery } = parseSearchText(q);
    if (tokens.length === 0) return { items: [], source: "empty" };

    // View được dựng lúc migration; sau khi khởi động (hoặc sau khi nạp dữ liệu mẫu) làm mới một lần để khỏi trả dữ liệu cũ.
    if (!this.refreshedOnce) {
      await this.refresh().catch((error) => logger.error("[SEARCH_INDEX] initial refresh failed:", error));
    }

    const type = normalizeType(query.type);
    const limit = normalizeLimit(query.limit);
    const typeFilter = type === "all" ? Prisma.empty : Prisma.sql`AND "type" = ${type}`;

    let rows = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT "type", "id", "title", "description", "slug", "category", "image", "departmentName", "price",
        (
          CASE "type"
            WHEN 'department' THEN CASE WHEN strpos("titleFolded", ${phrase}) > 0 THEN 30 ELSE 15 END
            WHEN 'doctor' THEN CASE WHEN strpos("titleFolded", ${phrase}) > 0 THEN 28 ELSE 14 END
            WHEN 'package' THEN CASE WHEN strpos("titleFolded", ${phrase}) > 0 THEN 24 ELSE 12 END
            ELSE CASE WHEN strpos("titleFolded", ${phrase}) > 0 THEN 20 ELSE 10 END
          END
          + "bonus"
          + CASE WHEN "titleFolded" LIKE ${phrase + "%"} THEN 3 ELSE 0 END
          + ts_rank("searchVector", query.tsq)
        ) AS "score"
      FROM ${searchDocumentTable}, to_tsquery('simple', ${tsQuery}) AS query(tsq)
      WHERE "searchVector" @@ query.tsq ${typeFilter}
      ORDER BY "score" DESC, "title" ASC
      LIMIT ${limit}
    `);

    // Không khớp từ nào: thử khớp gần đúng theo trigram trên tiêu đề (bắt lỗi gõ sai như "tim mahc").
    if (rows.length === 0 && phrase.length >= MIN_FUZZY_LENGTH && tokens.length <= MAX_FUZZY_TOKENS) {
      rows = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
        SELECT "type", "id", "title", "description", "slug", "category", "image", "departmentName", "price",
          similarity("titleFolded", ${phrase}) AS "score"
        FROM ${searchDocumentTable}
        WHERE "titleFolded" % ${phrase} ${typeFilter}
        ORDER BY "score" DESC, "title" ASC
        LIMIT ${limit}
      `);
    }

    return { items: rows.map(toResult), source: "postgres" };
  }
}

export default new PublicSearchService();

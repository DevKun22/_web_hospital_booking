export const SEARCH_DOCUMENT_TYPES = [
  "department",
  "doctor",
  "package",
  "faq",
] as const;

export type SearchDocumentType = (typeof SEARCH_DOCUMENT_TYPES)[number];

export type PublicSearchQuery = {
  q?: string;
  type?: SearchDocumentType | "all";
  limit?: number;
};

export type PublicSearchResult = {
  id: string;
  type: SearchDocumentType;
  title: string;
  description?: string | null;
  url: string;
  image?: string | null;
  departmentName?: string | null;
  price?: number | null;
  score?: number;
  source: "postgres";
};

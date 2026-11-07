"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type PublicSearchType =
  | "all"
  | "department"
  | "doctor"
  | "package"
  | "faq";

export type PublicSearchFilters = {
  q?: string;
  type?: PublicSearchType;
  limit?: number;
};

export type PublicSearchItem = {
  id: string;
  type: Exclude<PublicSearchType, "all">;
  title: string;
  description?: string | null;
  url: string;
  image?: string | null;
  departmentName?: string | null;
  price?: number | null;
  score?: number;
  source: "postgres";
};

export type PublicSearchResponse = {
  items: PublicSearchItem[];
  source: "empty" | "postgres";
};

export const fetchPublicSearch = (filters: PublicSearchFilters) =>
  apiRequest<PublicSearchResponse>("/search", {
    query: {
      q: filters.q?.trim(),
      type: filters.type || "all",
      limit: filters.limit,
    },
  });

export function usePublicSearch(filters: PublicSearchFilters) {
  const normalizedFilters = {
    ...filters,
    q: filters.q?.trim() || "",
    type: filters.type || "all",
  };

  return useQuery({
    queryKey: queryKeys.publicSearch(normalizedFilters),
    queryFn: () => fetchPublicSearch(normalizedFilters),
    enabled: normalizedFilters.q.length >= 2,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });
}

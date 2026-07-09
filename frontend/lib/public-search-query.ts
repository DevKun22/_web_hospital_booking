"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type PublicSearchType =
  | "all"
  | "department"
  | "doctor"
  | "package"
  | "faq"
  | "chatbot_faq";

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
  source: "elasticsearch" | "postgres";
};

export type PublicSearchResponse = {
  items: PublicSearchItem[];
  source: "empty" | "elasticsearch" | "postgres";
};

export type PublicSearchSuggestionsResponse = {
  items: string[];
  source: "analytics" | "default";
};

export const fetchPublicSearch = (filters: PublicSearchFilters) =>
  apiRequest<PublicSearchResponse>("/search", {
    query: {
      q: filters.q?.trim(),
      type: filters.type || "all",
      limit: filters.limit,
    },
  });

export const trackPublicSearch = (input: {
  keyword: string;
  type?: PublicSearchType;
  source?: PublicSearchResponse["source"];
  resultCount?: number;
}) =>
  apiRequest<{ tracked: boolean }>("/search/analytics", {
    method: "POST",
    body: {
      keyword: input.keyword,
      type: input.type || "all",
      source: input.source,
      resultCount: input.resultCount || 0,
    },
  });

export const fetchPublicSearchSuggestions = (limit = 5) =>
  apiRequest<PublicSearchSuggestionsResponse>("/search/suggestions", {
    query: { limit },
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

export function usePublicSearchSuggestions(limit = 5, enabled = true) {
  return useQuery({
    queryKey: queryKeys.publicSearchSuggestions({ limit }),
    queryFn: () => fetchPublicSearchSuggestions(limit),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

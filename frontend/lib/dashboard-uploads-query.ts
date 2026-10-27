"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ListResult, MediaAsset } from "@/lib/types";

export type DashboardUploadFilters = {
  isUsed?: string;
  folder?: string;
  page?: number;
  limit?: number;
};

export type CleanupUnusedMediaAssetsResult = {
  olderThan: string;
  scanned: number;
  deletedCount: number;
  failedCount: number;
  deleted: MediaAsset[];
  failed: { id: string; publicId: string; message: string }[];
};

export const fetchDashboardUploads = (filters: DashboardUploadFilters) =>
  apiRequest<ListResult<MediaAsset>>("/uploads/images", {
    query: filters,
  });

export function useDashboardUploads(
  filters: DashboardUploadFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.dashboardUploadsList(filters),
    queryFn: () => fetchDashboardUploads(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

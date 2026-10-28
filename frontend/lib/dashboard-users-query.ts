"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardUser, ListResult } from "@/lib/types";

export type DashboardUserFilters = {
  search?: string;
  role?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

export const fetchDashboardUsers = (filters: DashboardUserFilters) =>
  apiRequest<ListResult<DashboardUser>>("/dashboard/users", {
    query: filters,
  });

export function useDashboardUsers(
  filters: DashboardUserFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.dashboardUsers(filters),
    queryFn: () => fetchDashboardUsers(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

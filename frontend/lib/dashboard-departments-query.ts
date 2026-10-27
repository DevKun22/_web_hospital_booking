"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Department, ListResult } from "@/lib/types";

export type DashboardDepartmentFilters = {
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

export const fetchDashboardDepartments = (
  filters: DashboardDepartmentFilters,
) =>
  apiRequest<ListResult<Department>>("/dashboard/departments", {
    query: filters,
  });

export function useDashboardDepartments(filters: DashboardDepartmentFilters) {
  return useQuery({
    queryKey: queryKeys.dashboardDepartments(filters),
    queryFn: () => fetchDashboardDepartments(filters),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

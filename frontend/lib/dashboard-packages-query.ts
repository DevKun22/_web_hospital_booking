"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ListResult, MedicalPackage } from "@/lib/types";

export type DashboardPackageFilters = {
  search?: string;
  isActive?: string;
  isPopular?: string;
  page?: number;
  limit?: number;
};

export const fetchDashboardPackages = (filters: DashboardPackageFilters) =>
  apiRequest<ListResult<MedicalPackage>>("/dashboard/packages", {
    query: filters,
  });

export function useDashboardPackages(filters: DashboardPackageFilters) {
  return useQuery({
    queryKey: queryKeys.dashboardPackages(filters),
    queryFn: () => fetchDashboardPackages(filters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

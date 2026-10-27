"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ConsultationRequest, ListResult } from "@/lib/types";

export type DashboardConsultationRequestFilters = {
  status?: string;
  keyword?: string;
  page?: number;
  limit?: number;
};

export const fetchDashboardConsultationRequests = (
  filters: DashboardConsultationRequestFilters,
) =>
  apiRequest<ListResult<ConsultationRequest>>(
    "/dashboard/consultation-requests",
    {
      query: filters,
    },
  );

export const fetchDashboardConsultationRequest = (id: string) =>
  apiRequest<ConsultationRequest>(`/dashboard/consultation-requests/${id}`);

export function useDashboardConsultationRequests(
  filters: DashboardConsultationRequestFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.dashboardConsultationRequestsList(filters),
    queryFn: () => fetchDashboardConsultationRequests(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useDashboardConsultationRequest(id?: string) {
  return useQuery({
    queryKey: queryKeys.dashboardConsultationRequest(id),
    queryFn: () => fetchDashboardConsultationRequest(id || ""),
    enabled: Boolean(id),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

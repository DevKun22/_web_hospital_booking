"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Banner, PublicFAQ, SiteSettingsRecord } from "@/lib/types";

type ListResponse<T> = {
  items: T[];
};

export type DashboardBannerFilters = {
  position?: string;
  isActive?: string;
};

export type DashboardFAQFilters = {
  category?: string;
  isActive?: string;
};

export const fetchDashboardSiteSettings = () =>
  apiRequest<SiteSettingsRecord>("/dashboard/site-settings");

export const fetchDashboardBanners = async (
  filters: DashboardBannerFilters,
) => {
  const result = await apiRequest<ListResponse<Banner>>("/dashboard/banners", {
    query: filters,
  });

  return result.items || [];
};

export const fetchDashboardFAQs = async (filters: DashboardFAQFilters) => {
  const result = await apiRequest<ListResponse<PublicFAQ>>("/dashboard/faqs", {
    query: filters,
  });

  return result.items || [];
};

export function useDashboardSiteSettings(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.dashboardSiteSettings,
    queryFn: fetchDashboardSiteSettings,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useDashboardBanners(
  filters: DashboardBannerFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardBanners(filters),
    queryFn: () => fetchDashboardBanners(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useDashboardFAQs(
  filters: DashboardFAQFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardFAQs(filters),
    queryFn: () => fetchDashboardFAQs(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

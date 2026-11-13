"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import {
  hasPublicHomeData,
  toPublicHomeData,
  type PublicBootstrap,
  type PublicBootstrapSnapshot,
  type PublicBootstrapView,
} from "@/lib/public-bootstrap";
import { subscribePublicContentUpdated } from "@/lib/public-content-sync";
import { queryKeys } from "@/lib/query-keys";
import type { SiteSettingsValue } from "@/lib/types";

const STALE_MS = 60 * 1000;

export const fetchPublicBootstrap = async (view: PublicBootstrapView) =>
  toPublicHomeData(await apiRequest<PublicBootstrap>("/public/bootstrap", { query: { view } }));

// Dữ liệu công khai cho trang chủ và trang đặt lịch: dùng bản máy chủ đã dựng sẵn, chỉ tải lại khi bản đó
// đã cũ hơn 60 giây, khi quay lại cửa sổ, hoặc khi quản trị vừa sửa nội dung ở tab khác.
export function usePublicBootstrap(view: PublicBootstrapView, initial: PublicBootstrapSnapshot) {
  const hasInitial = hasPublicHomeData(initial.data);
  const query = useQuery({
    queryKey: queryKeys.publicBootstrap(view),
    queryFn: () => fetchPublicBootstrap(view),
    initialData: hasInitial ? initial.data : undefined,
    initialDataUpdatedAt: hasInitial ? initial.fetchedAt : undefined,
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const { refetch } = query;

  useEffect(() => subscribePublicContentUpdated(() => void refetch()), [refetch]);

  const data = query.data ?? initial.data;
  const hasData = hasPublicHomeData(data);
  return {
    data,
    loading: query.isLoading || (query.isFetching && !hasData),
    // Lỗi lúc dựng trang chỉ có nghĩa khi vẫn chưa có dữ liệu nào.
    error: query.error instanceof Error ? query.error.message : hasData ? "" : initial.error,
    refetch,
  };
}

export const fetchPublicSiteSettings = () => apiRequest<SiteSettingsValue>("/site-settings");

export function usePublicSiteSettings() {
  return useQuery({
    queryKey: queryKeys.publicSiteSettings,
    queryFn: fetchPublicSiteSettings,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

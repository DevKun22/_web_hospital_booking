"use client";

import { useEffect } from "react";
import { PublicHomeView } from "@/components/public/public-home-view";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { subscribePublicContentUpdated } from "@/lib/public-content-sync";
import { hasPublicHomeData, usePublicHomeData } from "@/lib/public-home-query";

export function PublicHomeClient({
  data,
  error = "",
}: {
  data: PublicHomeData;
  error?: string;
}) {
  const homeQuery = usePublicHomeData(data);
  const { refetch } = homeQuery;

  useEffect(
    () => subscribePublicContentUpdated(() => void refetch()),
    [refetch],
  );

  const homeData = homeQuery.data || data;
  const queryError =
    homeQuery.error instanceof Error ? homeQuery.error.message : "";
  const displayError = queryError || error;
  const loading =
    homeQuery.isLoading ||
    (homeQuery.isFetching && !hasPublicHomeData(homeData));

  return (
    <PublicHomeView data={homeData} loading={loading} error={displayError} />
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  emptyHomeData,
  type PublicHomeData,
} from "@/components/public/public-home-types";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  Banner,
  DoctorProfile,
  HomePageConfigValue,
  MedicalPackage,
  PublicFAQ,
  SiteSettingsValue,
} from "@/lib/types";

export const buildPublicHomeData = (
  settings: SiteSettingsValue,
  homeConfig: HomePageConfigValue | null,
  banners: Banner[],
  departments: PublicHomeData["departments"],
  doctors: DoctorProfile[],
  packages: MedicalPackage[],
  faqs: PublicFAQ[],
): PublicHomeData => {
  const heroBanners = banners.filter((banner) => banner.position === "HOME_HERO");

  return {
    settings,
    homeConfig,
    heroBanners,
    promoBanners: [],
    partnerBanners: banners.filter((banner) => banner.position === "HOME_PARTNER"),
    departments,
    doctors,
    packages,
    faqs,
  };
};

export const fetchPublicHomeData = async () => {
  const bootstrap = await apiRequest<{
    siteSettings: SiteSettingsValue;
    homeConfig: HomePageConfigValue | null;
    banners: Banner[];
    departments: PublicHomeData["departments"];
    doctors: DoctorProfile[];
    packages: MedicalPackage[];
    faqs: PublicFAQ[];
  }>("/public/bootstrap", { query: { view: "featured" } });

  return buildPublicHomeData(
    bootstrap.siteSettings,
    bootstrap.homeConfig,
    bootstrap.banners || [],
    bootstrap.departments,
    bootstrap.doctors,
    bootstrap.packages,
    bootstrap.faqs,
  );
};

export const fetchPublicSiteSettings = () =>
  apiRequest<SiteSettingsValue>("/site-settings");

export const hasPublicHomeData = (data: PublicHomeData) =>
  Boolean(
    data.settings ||
    data.homeConfig ||
    data.heroBanners.length ||
    data.departments.length ||
    data.doctors.length ||
    data.packages.length ||
    data.faqs.length,
  );

export function usePublicHomeData(initialData: PublicHomeData = emptyHomeData) {
  const hasInitialData = hasPublicHomeData(initialData);

  return useQuery({
    queryKey: queryKeys.publicHome,
    queryFn: fetchPublicHomeData,
    initialData: hasInitialData ? initialData : undefined,
    // Dữ liệu SSR có thể đến từ cache của Next.js. Đánh dấu dữ liệu khởi tạo
    // là cũ để trình duyệt kiểm tra lại đúng một lần sau khi hydrate.
    initialDataUpdatedAt: hasInitialData ? 0 : undefined,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePublicSiteSettings() {
  return useQuery({
    queryKey: queryKeys.publicSiteSettings,
    queryFn: fetchPublicSiteSettings,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

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
  MedicalPackage,
  PublicFAQ,
  SiteSettingsValue,
} from "@/lib/types";

export const buildPublicHomeData = (
  settings: SiteSettingsValue,
  banners: Banner[],
  departments: PublicHomeData["departments"],
  doctors: DoctorProfile[],
  packages: MedicalPackage[],
  faqs: PublicFAQ[],
): PublicHomeData => {
  const heroPositions = new Set(["HOME_HERO", "HOME_PROMO", "HOME_DEPARTMENT"]);
  const heroBanners = banners.filter((banner) =>
    heroPositions.has(banner.position),
  );
  const promoBanners = banners.filter(
    (banner) => banner.position === "HOME_PROMO",
  );

  return {
    settings,
    heroBanners: heroBanners.length ? heroBanners : banners,
    promoBanners,
    departments,
    doctors,
    packages,
    faqs,
  };
};

export const fetchPublicHomeData = async () => {
  const bootstrap = await apiRequest<{
    siteSettings: SiteSettingsValue;
    banners: Banner[];
    departments: PublicHomeData["departments"];
    doctors: DoctorProfile[];
    packages: MedicalPackage[];
    faqs: PublicFAQ[];
  }>("/public/bootstrap", { query: { view: "full" } });

  return buildPublicHomeData(
    bootstrap.siteSettings,
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
    data.heroBanners.length ||
    data.departments.length ||
    data.doctors.length ||
    data.packages.length ||
    data.faqs.length,
  );

export function usePublicHomeData(initialData: PublicHomeData = emptyHomeData) {
  return useQuery({
    queryKey: queryKeys.publicHome,
    queryFn: fetchPublicHomeData,
    initialData: hasPublicHomeData(initialData) ? initialData : undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
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

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  emptyHomeData,
  type PublicHomeData,
} from "@/components/public/public-home-types";
import { apiRequest } from "@/lib/api";
import {
  buildPublicHomeData,
  hasPublicHomeData,
} from "@/lib/public-home-query";
import { queryKeys } from "@/lib/query-keys";
import type {
  Banner,
  DoctorProfile,
  HomePageConfigValue,
  MedicalPackage,
  PublicFAQ,
  SiteSettingsValue,
} from "@/lib/types";

export type PublicSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type PublicAvailableSlotFilters = {
  doctorId?: string;
  date?: string;
};

export const fetchPublicAvailableSlots = (
  filters: Required<PublicAvailableSlotFilters>,
) =>
  apiRequest<PublicSlot[]>(`/doctors/${filters.doctorId}/available-slots`, {
    query: { date: filters.date },
  });

export function usePublicAvailableSlots(filters: PublicAvailableSlotFilters) {
  return useQuery({
    queryKey: queryKeys.publicAvailableSlots(filters),
    queryFn: () =>
      fetchPublicAvailableSlots({
        doctorId: filters.doctorId || "",
        date: filters.date || "",
      }),
    enabled: Boolean(filters.doctorId && filters.date),
    // The backend validates slot availability again when an appointment is
    // created, so a short aggressive poll only adds load without improving
    // correctness. Refresh on focus/reconnect and once per minute while the
    // booking screen remains visible.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export const fetchPublicBookingData = async () => {
  const bootstrap = await apiRequest<{
    siteSettings: SiteSettingsValue;
    homeConfig: HomePageConfigValue | null;
    banners: Banner[];
    departments: PublicHomeData["departments"];
    doctors: DoctorProfile[];
    packages: MedicalPackage[];
    faqs: PublicFAQ[];
  }>("/public/bootstrap", { query: { view: "full" } });

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

export function usePublicBookingData(
  initialData: PublicHomeData = emptyHomeData,
) {
  const hasInitialData = hasPublicHomeData(initialData);

  return useQuery({
    queryKey: queryKeys.publicBooking,
    queryFn: fetchPublicBookingData,
    initialData: hasInitialData ? initialData : undefined,
    initialDataUpdatedAt: hasInitialData ? 0 : undefined,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

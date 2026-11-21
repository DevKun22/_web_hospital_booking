"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type PublicSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Nơi khám của khung giờ; thiếu thì là cơ sở mặc định. */
  facility?: { id: string; name: string; address: string } | null;
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

/** Ngày còn khung giờ trống và số khung còn lại của ngày đó. */
export type PublicAvailableDate = { date: string; count: number };

export type PublicAvailableDateFilters = { doctorId?: string; from?: string; to?: string };

export const fetchPublicAvailableDates = (filters: Required<PublicAvailableDateFilters>) =>
  apiRequest<PublicAvailableDate[]>(`/doctors/${filters.doctorId}/available-dates`, {
    query: { from: filters.from, to: filters.to },
  });

export function usePublicAvailableDates(filters: PublicAvailableDateFilters) {
  return useQuery({
    queryKey: queryKeys.publicAvailableDates(filters),
    queryFn: () => fetchPublicAvailableDates({ doctorId: filters.doctorId || "", from: filters.from || "", to: filters.to || "" }),
    enabled: Boolean(filters.doctorId && filters.from && filters.to),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

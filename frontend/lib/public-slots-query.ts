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

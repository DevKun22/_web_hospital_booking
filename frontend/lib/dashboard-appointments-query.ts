"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Appointment, DoctorProfile, ListResult } from "@/lib/types";

export type DashboardAppointmentFilters = {
  status?: string;
  doctorId?: string;
  date?: string;
  phone?: string;
  bookingCode?: string;
  billingState?: "PENDING_INVOICE" | "HAS_INVOICE";
  page?: number;
  limit?: number;
};

export type DashboardAppointmentDoctorFilters = {
  page?: number;
  limit?: number;
};

export const fetchDashboardAppointments = (
  filters: DashboardAppointmentFilters,
) =>
  apiRequest<ListResult<Appointment>>("/dashboard/appointments", {
    query: filters,
  });

export const fetchDashboardAppointmentDoctors = (
  filters: DashboardAppointmentDoctorFilters,
) =>
  apiRequest<ListResult<DoctorProfile>>("/dashboard/doctors", {
    query: filters,
  });

export function useDashboardAppointments(filters: DashboardAppointmentFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboardAppointments(filters),
    queryFn: () => fetchDashboardAppointments(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardPendingInvoiceAppointments(enabled: boolean) {
  const filters = {
    status: "COMPLETED",
    billingState: "PENDING_INVOICE" as const,
    page: 1,
    limit: 1,
  };

  return useQuery({
    queryKey: queryKeys.dashboardAppointments(filters),
    queryFn: () => fetchDashboardAppointments(filters),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardAppointmentDoctors(
  filters: DashboardAppointmentDoctorFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctors(filters),
    queryFn: () => fetchDashboardAppointmentDoctors(filters),
    enabled,
    staleTime: 5 * 60_000,
  });
}

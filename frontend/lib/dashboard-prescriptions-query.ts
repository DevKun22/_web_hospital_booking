"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { DoctorProfile, ListResult, Prescription } from "@/lib/types";

export type DashboardPrescriptionFilters = {
  status?: string;
  doctorId?: string;
  prescriptionCode?: string;
  medicalRecordId?: string;
  page?: number;
  limit?: number;
};

export type DashboardPrescriptionDoctorFilters = {
  page?: number;
  limit?: number;
};

export const fetchDashboardPrescriptions = (
  filters: DashboardPrescriptionFilters,
) =>
  apiRequest<ListResult<Prescription>>("/dashboard/prescriptions", {
    query: filters,
  });

export const fetchDashboardPrescription = (id: string) =>
  apiRequest<Prescription>(`/dashboard/prescriptions/${id}`);

export const fetchDashboardPrescriptionDoctors = (
  filters: DashboardPrescriptionDoctorFilters,
) =>
  apiRequest<ListResult<DoctorProfile>>("/dashboard/doctors", {
    query: filters,
  });

export function useDashboardPrescriptions(
  filters: DashboardPrescriptionFilters,
) {
  return useQuery({
    queryKey: queryKeys.dashboardPrescriptionsList(filters),
    queryFn: () => fetchDashboardPrescriptions(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardPrescription(id?: string) {
  return useQuery({
    queryKey: queryKeys.dashboardPrescription(id),
    queryFn: () => fetchDashboardPrescription(id || ""),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useDashboardPrescriptionDoctors(
  filters: DashboardPrescriptionDoctorFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctors(filters),
    queryFn: () => fetchDashboardPrescriptionDoctors(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

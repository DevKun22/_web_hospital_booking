"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { DoctorProfile, ListResult, MedicalRecord } from "@/lib/types";

export type DashboardMedicalRecordFilters = {
  status?: string;
  doctorId?: string;
  date?: string;
  recordCode?: string;
  page?: number;
  limit?: number;
};

export type DashboardMedicalRecordDoctorFilters = {
  page?: number;
  limit?: number;
};

export const fetchDashboardMedicalRecords = (
  filters: DashboardMedicalRecordFilters,
) =>
  apiRequest<ListResult<MedicalRecord>>("/dashboard/medical-records", {
    query: filters,
  });

export const fetchDashboardMedicalRecord = (id: string) =>
  apiRequest<MedicalRecord>(`/dashboard/medical-records/${id}`);

export const fetchDashboardMedicalRecordDoctors = (
  filters: DashboardMedicalRecordDoctorFilters,
) =>
  apiRequest<ListResult<DoctorProfile>>("/dashboard/doctors", {
    query: filters,
  });

export function useDashboardMedicalRecords(
  filters: DashboardMedicalRecordFilters,
) {
  return useQuery({
    queryKey: queryKeys.dashboardMedicalRecords(filters),
    queryFn: () => fetchDashboardMedicalRecords(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardMedicalRecord(id?: string) {
  return useQuery({
    queryKey: queryKeys.dashboardMedicalRecord(id),
    queryFn: () => fetchDashboardMedicalRecord(id || ""),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useDashboardMedicalRecordDoctors(
  filters: DashboardMedicalRecordDoctorFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctors(filters),
    queryFn: () => fetchDashboardMedicalRecordDoctors(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

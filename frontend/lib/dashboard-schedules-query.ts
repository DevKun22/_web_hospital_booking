"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  DoctorProfile,
  DoctorSchedule,
  DoctorTimeSlot,
  ListResult,
} from "@/lib/types";

export type DashboardScheduleDoctorFilters = {
  isAvailable?: string;
  page?: number;
  limit?: number;
};

export type DashboardDoctorScheduleFilters = {
  doctorId?: string;
  dayOfWeek?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

export type DashboardDoctorTimeSlotFilters = {
  doctorId?: string;
  date?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export const fetchDashboardScheduleDoctors = (
  filters: DashboardScheduleDoctorFilters,
) =>
  apiRequest<ListResult<DoctorProfile>>("/dashboard/doctors", {
    query: filters,
  });

export const fetchDashboardDoctorSchedules = (
  filters: DashboardDoctorScheduleFilters,
) =>
  apiRequest<ListResult<DoctorSchedule>>("/dashboard/doctor-schedules", {
    query: filters,
  });

export const fetchDashboardDoctorTimeSlots = (
  filters: DashboardDoctorTimeSlotFilters,
) =>
  apiRequest<ListResult<DoctorTimeSlot>>("/dashboard/doctor-time-slots", {
    query: filters,
  });

export function useDashboardScheduleDoctors(
  filters: DashboardScheduleDoctorFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctors(filters),
    queryFn: () => fetchDashboardScheduleDoctors(filters),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardDoctorSchedules(
  filters: DashboardDoctorScheduleFilters,
) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctorSchedules(filters),
    queryFn: () => fetchDashboardDoctorSchedules(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardDoctorTimeSlots(
  filters: DashboardDoctorTimeSlotFilters,
) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctorTimeSlots(filters),
    queryFn: () => fetchDashboardDoctorTimeSlots(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

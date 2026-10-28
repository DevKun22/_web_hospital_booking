"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  Appointment,
  DashboardAppointmentStatistics,
  DashboardDepartmentStatistics,
  DashboardDoctorStatistics,
  DashboardRevenueStatistics,
  DashboardStatisticsOverview,
  DoctorTimeSlot,
  MedicalRecord,
  Prescription,
} from "@/lib/types";

export type DashboardStatisticsFilters = {
  from?: string;
  to?: string;
};

export type DashboardStatisticsData = {
  overview: DashboardStatisticsOverview;
  appointments: DashboardAppointmentStatistics;
  revenue: DashboardRevenueStatistics;
  doctors: DashboardDoctorStatistics;
  departments: DashboardDepartmentStatistics;
};

export type DoctorDashboardData = {
  todayAppointments: Appointment[];
  checkedInAppointments: Appointment[];
  inProgressAppointments: Appointment[];
  draftRecords: MedicalRecord[];
  draftPrescriptions: Prescription[];
  todaySlots: DoctorTimeSlot[];
};

export const fetchDashboardStatistics = async (
  filters: DashboardStatisticsFilters,
): Promise<DashboardStatisticsData> =>
  apiRequest<DashboardStatisticsData>("/dashboard/statistics/workspace", {
    query: filters,
  });

export const fetchDoctorDashboardOverview = async (
  date: string,
): Promise<DoctorDashboardData> =>
  apiRequest<DoctorDashboardData>("/dashboard/statistics/doctor-workspace", {
    query: { date },
  });

export function useDashboardStatistics(
  filters: DashboardStatisticsFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboardStatistics(filters),
    queryFn: () => fetchDashboardStatistics(filters),
    enabled,
    staleTime: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDoctorDashboardOverview(date: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.dashboardDoctorOverview({ date }),
    queryFn: () => fetchDoctorDashboardOverview(date),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  PublicDepartment,
  PublicDepartmentCatalogResponse,
  PublicPackageCatalogResponse,
} from "@/components/public/public-home-types";
import type { DoctorProfile, MedicalPackage, Pagination } from "@/lib/types";

export type PublicDepartmentFilters = {
  search?: string;
};

export type PublicDepartmentCatalogFilters = {
  search?: string;
  available?: boolean;
  sort?: "POPULAR_DESC" | "NAME_ASC";
  page?: number;
  limit?: number;
};

export type PublicDoctorFilters = {
  search?: string;
  departmentId?: string;
  departmentSlug?: string;
};

export type PublicDoctorCatalogFilters = {
  search?: string;
  departmentId?: string;
  minExperience?: number;
  availableToday?: boolean;
  sort?: "NAME_ASC" | "EXPERIENCE_DESC";
  page?: number;
  limit?: number;
};

export type PublicDoctorCatalogResponse = {
  items: DoctorProfile[];
  pagination: Pagination;
  summary: {
    publicReviewCount: number;
    doctorsWithTodaySlots: number;
  };
};

export type PublicPackageFilters = {
  search?: string;
  isPopular?: boolean;
};

export type PublicPackageCatalogFilters = {
  search?: string;
  departmentId?: string;
  isPopular?: boolean;
  isBHYTSupport?: boolean;
  sort?: "POPULAR_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC";
  page?: number;
  limit?: number;
};

export const fetchPublicDepartments = (filters: PublicDepartmentFilters = {}) =>
  apiRequest<PublicDepartment[]>("/departments", {
    query: filters,
  });

export const fetchPublicDepartmentCatalog = (
  filters: PublicDepartmentCatalogFilters = {},
) =>
  apiRequest<PublicDepartmentCatalogResponse>("/departments/catalog", {
    query: filters,
  });

export const fetchPublicDoctors = (filters: PublicDoctorFilters = {}) =>
  apiRequest<DoctorProfile[]>("/doctors", {
    query: filters,
  });

export const fetchPublicDoctorCatalog = (
  filters: PublicDoctorCatalogFilters = {},
) =>
  apiRequest<PublicDoctorCatalogResponse>("/doctors/catalog", {
    query: filters,
  });

export const fetchPublicPackages = (filters: PublicPackageFilters = {}) =>
  apiRequest<MedicalPackage[]>("/packages", {
    query: filters,
  });

export const fetchPublicPackageCatalog = (
  filters: PublicPackageCatalogFilters = {},
) =>
  apiRequest<PublicPackageCatalogResponse>("/packages/catalog", {
    query: filters,
  });

export function usePublicDepartments(filters: PublicDepartmentFilters = {}) {
  return useQuery({
    queryKey: queryKeys.publicDepartments(filters),
    queryFn: () => fetchPublicDepartments(filters),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePublicDepartmentCatalog(
  filters: PublicDepartmentCatalogFilters = {},
) {
  return useQuery({
    queryKey: queryKeys.publicDepartmentCatalog(filters),
    queryFn: () => fetchPublicDepartmentCatalog(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePublicDoctors(filters: PublicDoctorFilters = {}) {
  return useQuery({
    queryKey: queryKeys.publicDoctors(filters),
    queryFn: () => fetchPublicDoctors(filters),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePublicDoctorCatalog(
  filters: PublicDoctorCatalogFilters = {},
) {
  return useQuery({
    queryKey: queryKeys.publicDoctorCatalog(filters),
    queryFn: () => fetchPublicDoctorCatalog(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePublicPackages(filters: PublicPackageFilters = {}) {
  return useQuery({
    queryKey: queryKeys.publicPackages(filters),
    queryFn: () => fetchPublicPackages(filters),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function usePublicPackageCatalog(
  filters: PublicPackageCatalogFilters = {},
) {
  return useQuery({
    queryKey: queryKeys.publicPackageCatalog(filters),
    queryFn: () => fetchPublicPackageCatalog(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

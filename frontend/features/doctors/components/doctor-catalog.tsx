"use client";

import { useMemo } from "react";
import { PublicCatalogSection, PublicEmptyState } from "@/components/public/public-page-layout";
import { DoctorCard } from "@/features/doctors/components/doctor-card";
import { DoctorFilterBar } from "@/features/doctors/components/doctor-filter-bar";
import { DoctorHelpCta } from "@/features/doctors/components/doctor-help-cta";
import { DoctorHero } from "@/features/doctors/components/doctor-hero";
import { DoctorPagination } from "@/features/doctors/components/doctor-pagination";
import { DoctorSkeleton } from "@/features/doctors/components/doctor-skeleton";
import { PAGE_SIZE } from "@/features/doctors/filters";
import { useDoctorFilters } from "@/features/doctors/use-doctor-filters";
import { getVietnamDateInput } from "@/lib/date";
import { usePublicDepartments, usePublicDoctorCatalog } from "@/lib/public-lists-query";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "");

export function DoctorCatalog() {
  const state = useDoctorFilters();
  const { filters, setPage, reset, hasActiveFilters } = state;

  const departmentsQuery = usePublicDepartments();
  const doctorsQuery = usePublicDoctorCatalog({
    search: filters.search || undefined,
    departmentId: filters.departmentId || undefined,
    minExperience: filters.minExperience ? Number(filters.minExperience) : undefined,
    availableToday: filters.availableToday || undefined,
    sort: filters.sort,
    page: filters.page,
    limit: PAGE_SIZE,
  });

  const departments = useMemo(() => departmentsQuery.data || [], [departmentsQuery.data]);
  const doctors = doctorsQuery.data?.items || [];
  const pagination = doctorsQuery.data?.pagination;
  const summary = doctorsQuery.data?.summary;
  const loading = doctorsQuery.isLoading;
  const refreshing = doctorsQuery.isFetching && !loading;
  const selectedDepartment = departments.find((item) => item.id === filters.departmentId);
  const today = getVietnamDateInput();

  const changePage = (page: number) => {
    setPage(page);
    document.getElementById("doctor-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <DoctorHero total={pagination?.total} departmentCount={departments.length} withTodaySlots={summary?.doctorsWithTodaySlots} reviewCount={summary?.publicReviewCount} />
      <DoctorFilterBar state={state} departments={departments} />

      <PublicCatalogSection
        status={loading ? "Đang tải bác sĩ..." : `${pagination?.total || 0} bác sĩ${selectedDepartment ? ` thuộc ${selectedDepartment.name}` : ""}${refreshing ? " · Đang cập nhật" : ""}`}
        error={messageOf(departmentsQuery.error) || messageOf(doctorsQuery.error)}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={reset}
      >
        <div id="doctor-results" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy={refreshing}>
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => <DoctorSkeleton key={index} />)
          ) : doctors.length ? (
            doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} today={today} />)
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <PublicEmptyState>Chưa tìm thấy bác sĩ phù hợp. Hãy thử từ khóa hoặc chuyên khoa khác.</PublicEmptyState>
            </div>
          )}
        </div>
        {pagination ? <DoctorPagination pagination={pagination} onChange={changePage} /> : null}
      </PublicCatalogSection>

      <DoctorHelpCta />
    </>
  );
}

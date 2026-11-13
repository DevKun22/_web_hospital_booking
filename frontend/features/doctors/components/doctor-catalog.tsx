"use client";

import { useMemo } from "react";
import { CatalogHeader, ChatbotHint, RowList, RowSkeleton } from "@/components/public/catalog-parts";
import { PublicCatalogSection, PublicEmptyState } from "@/components/public/public-page-layout";
import { DoctorCard } from "@/features/doctors/components/doctor-card";
import { DoctorFilterBar } from "@/features/doctors/components/doctor-filter-bar";
import { DoctorPagination } from "@/features/doctors/components/doctor-pagination";
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
      <CatalogHeader current="Bác sĩ" title="Đội ngũ bác sĩ" description="Tìm bác sĩ theo tên, chuyên khoa, kinh nghiệm. Giờ trống hôm nay bấm vào là đặt lịch ngay." />
      <DoctorFilterBar state={state} departments={departments} />

      <PublicCatalogSection
        status={loading ? "Đang tải bác sĩ..." : `${pagination?.total || 0} bác sĩ${selectedDepartment ? ` thuộc ${selectedDepartment.name}` : ""}${refreshing ? " · Đang cập nhật" : ""}`}
        error={messageOf(departmentsQuery.error) || messageOf(doctorsQuery.error)}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={reset}
      >
        <div id="doctor-results" aria-busy={refreshing}>
          {loading ? (
            <RowSkeleton rows={4} />
          ) : doctors.length ? (
            <RowList busy={refreshing}>
              {doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} today={today} />)}
            </RowList>
          ) : (
            <PublicEmptyState>Chưa tìm thấy bác sĩ phù hợp. Thử từ khóa hoặc chuyên khoa khác.</PublicEmptyState>
          )}
        </div>
        {pagination ? <DoctorPagination pagination={pagination} onChange={changePage} /> : null}
        <ChatbotHint>Chưa rõ nên chọn bác sĩ hay chuyên khoa nào?</ChatbotHint>
      </PublicCatalogSection>

    </>
  );
}

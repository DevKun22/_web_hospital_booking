"use client";

import { useMemo } from "react";
import { CatalogHeader, CatalogStatusBar, ChatbotHint } from "@/components/public/catalog-parts";
import { PublicEmptyState } from "@/components/public/public-page-layout";
import { DoctorCard } from "@/features/doctors/components/doctor-card";
import { DoctorFilterBar } from "@/features/doctors/components/doctor-filter-bar";
import { DoctorPagination } from "@/features/doctors/components/doctor-pagination";
import { PAGE_SIZE } from "@/features/doctors/filters";
import { useDoctorFilters } from "@/features/doctors/use-doctor-filters";
import { usePublicDepartments, usePublicDoctorCatalog } from "@/lib/public-lists-query";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "");

export function DoctorCatalog() {
  const state = useDoctorFilters();
  const { filters, setPage, reset, update, setSearchInput } = state;

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

  const changePage = (page: number) => {
    setPage(page);
    document.getElementById("doctor-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <CatalogHeader brand current="Bác sĩ" title="Đội ngũ bác sĩ" description="Tìm bác sĩ theo tên, chuyên khoa, kinh nghiệm. Chọn bác sĩ rồi đặt lịch theo giờ còn trống.">
        <DoctorFilterBar state={state} departments={departments} />
      </CatalogHeader>

      <CatalogStatusBar
        status={loading ? "Đang tải bác sĩ..." : `${pagination?.total || 0} bác sĩ${refreshing ? " · Đang cập nhật" : ""}`}
        chips={[
          ...(filters.search ? [{ key: "search", label: `“${filters.search}”`, onRemove: () => setSearchInput("") }] : []),
          ...(selectedDepartment ? [{ key: "department", label: selectedDepartment.name, onRemove: () => update({ departmentId: "" }) }] : []),
          ...(filters.minExperience ? [{ key: "experience", label: `Từ ${filters.minExperience} năm`, onRemove: () => update({ minExperience: "" }) }] : []),
          ...(filters.availableToday ? [{ key: "today", label: "Có lịch hôm nay", onRemove: () => update({ availableToday: false }) }] : []),
        ]}
        onReset={reset}
      />

      <section className="ui-container py-6 sm:py-8" aria-busy={loading || refreshing}>
        {messageOf(departmentsQuery.error) || messageOf(doctorsQuery.error) ? (
          <div className="ui-status-danger mb-4 rounded-xl border px-4 py-3 text-sm" role="alert">
            {messageOf(departmentsQuery.error) || messageOf(doctorsQuery.error)}
          </div>
        ) : null}
        <div id="doctor-results" aria-busy={refreshing}>
          {loading ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
              {Array.from({ length: 8 }).map((_, index) => <li key={index}><span className="skeleton-shimmer block h-72 rounded-2xl" /></li>)}
            </ul>
          ) : doctors.length ? (
            <ul aria-busy={refreshing} className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${refreshing ? "opacity-70" : ""}`}>
              {doctors.map((doctor, index) => <DoctorCard key={doctor.id} doctor={doctor} index={index} />)}
            </ul>
          ) : (
            <PublicEmptyState>Chưa tìm thấy bác sĩ phù hợp. Thử từ khóa hoặc chuyên khoa khác.</PublicEmptyState>
          )}
        </div>
        {pagination ? <DoctorPagination pagination={pagination} onChange={changePage} /> : null}
        <ChatbotHint>Chưa rõ nên chọn bác sĩ hay chuyên khoa nào?</ChatbotHint>
      </section>

    </>
  );
}

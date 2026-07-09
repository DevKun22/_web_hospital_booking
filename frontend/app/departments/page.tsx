"use client";

/* eslint-disable @next/next/no-img-element */

import { HeartPulse, Search, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicEmptyState, PublicPageHeader, PublicPageHero } from "@/components/public/public-page-layout";
import { usePublicDepartments } from "@/lib/public-lists-query";

export default function PublicDepartmentsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const departmentsQuery = usePublicDepartments({ search: debouncedSearch.trim() || undefined });
  const departments = departmentsQuery.data || [];
  const loading = departmentsQuery.isLoading || (departmentsQuery.isFetching && !departments.length);
  const error = departmentsQuery.error instanceof Error ? departmentsQuery.error.message : "";
  const totalLabel = useMemo(() => {
    if (loading) return "Đang tải chuyên khoa...";

    return `${departments.length} chuyên khoa đang hiển thị`;
  }, [departments.length, loading]);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <PublicPageHeader />
      <PublicPageHero
        eyebrow="Chuyên khoa"
        title="Tìm đúng chuyên khoa để bắt đầu đặt lịch"
        description="Mỗi chuyên khoa có đội ngũ bác sĩ và gói khám liên quan. Bạn có thể xem chi tiết hoặc chuyển thẳng đến form đặt lịch."
      >
          <div className="public-filter-panel mt-6 max-w-2xl p-3 sm:p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667892]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm chuyên khoa theo tên hoặc slug"
                className="ui-field w-full py-3 pl-10 pr-3 text-sm shadow-sm"
              />
            </label>
          </div>
      </PublicPageHero>

      <section className="ui-container py-10 sm:py-12">
        {error ? <div className="mb-4 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-4 py-3 text-sm text-[#b3261e]">{error}</div> : null}
        <p className="mb-4 text-sm text-[#667892]">{totalLabel}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? Array.from({ length: 6 }).map((_, index) => <DepartmentSkeleton key={index} />) : departments.length ? departments.map((department) => (
            <article key={department.id} className="public-card overflow-hidden">
              <div className="public-card-media">
                {department.image ? (
                  <img src={department.image} alt={department.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#0d4f8b]">
                    <HeartPulse className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="public-card-body">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e7f0fb] text-[#0d4f8b]">
                    <Stethoscope className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{department.name}</h2>
                    <p className="public-card-description mt-2 line-clamp-3 text-sm leading-6 text-[#667892]">
                      {department.description || "Đội ngũ chuyên môn sẵn sàng tư vấn, tiếp nhận lịch khám và điều phối bác sĩ phù hợp."}
                    </p>
                  </div>
                </div>

                <div className="public-card-actions">
                  {department.slug ? (
                    <Link href={`/departments/${department.slug}`} className="rounded-md border border-[#cfd8e6] px-3 py-2.5 text-center text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">
                      Chi tiết
                    </Link>
                  ) : (
                    <Link href={`/doctors?departmentId=${department.id}`} className="rounded-md border border-[#cfd8e6] px-3 py-2.5 text-center text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">
                      Bác sĩ
                    </Link>
                  )}
                  <Link href={`/?departmentId=${department.id}#booking`} className="rounded-md bg-[#0d4f8b] px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#083d6d]">
                    Đặt lịch
                  </Link>
                </div>
              </div>
            </article>
          )) : (
            <div className="sm:col-span-2 lg:col-span-3"><PublicEmptyState>Chưa tìm thấy chuyên khoa phù hợp.</PublicEmptyState></div>
          )}
        </div>
      </section>
    </main>
  );
}

function DepartmentSkeleton() {
  return (
    <article className="public-card overflow-hidden">
      <span className="skeleton-shimmer block h-44 rounded-none" />
      <div className="space-y-3 p-4">
        <span className="skeleton-shimmer block h-5 w-2/3 rounded-md" />
        <span className="skeleton-shimmer block h-4 w-full rounded-md" />
        <span className="skeleton-shimmer block h-4 w-5/6 rounded-md" />
        <span className="skeleton-shimmer block h-10 w-full rounded-md" />
      </div>
    </article>
  );
}

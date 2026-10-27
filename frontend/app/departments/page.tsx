"use client";

/* eslint-disable @next/next/no-img-element */

import { HeartPulse, Search, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicEmptyState, PublicPageHero } from "@/components/public/public-page-layout";
import { usePublicDepartments } from "@/lib/public-lists-query";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";

const pageJsonLd = buildCollectionPageJsonLd({
  name: "Chuyên khoa",
  description: "Danh sách chuyên khoa, thông tin dịch vụ khám và đặt lịch theo chuyên khoa.",
  path: "/departments",
});

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
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }} />
      <PublicPageHero
        eyebrow="Chuyên khoa"
        title="Tìm đúng chuyên khoa để bắt đầu đặt lịch"
        description="Mỗi chuyên khoa có đội ngũ bác sĩ và gói khám liên quan. Bạn có thể xem chi tiết hoặc chuyển thẳng đến form đặt lịch."
      >
          <div className="public-filter-panel mt-6 max-w-2xl p-3 sm:p-4">
            <label className="relative block">
              <span className="sr-only">Tìm chuyên khoa</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm chuyên khoa theo tên"
                className="ui-field w-full py-3 pl-10 pr-3 text-base shadow-sm sm:text-sm"
              />
            </label>
          </div>
      </PublicPageHero>

      <section className="ui-container py-10 sm:py-12">
        {error ? <div className="ui-status-danger mb-4 rounded-xl border px-4 py-3 text-sm" role="alert">{error}</div> : null}
        <p className="mb-5 text-sm font-medium text-[var(--public-muted)]" aria-live="polite">{totalLabel}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? Array.from({ length: 6 }).map((_, index) => <DepartmentSkeleton key={index} />) : departments.length ? departments.map((department) => (
            <article key={department.id} className="public-card overflow-hidden">
              <div className="public-card-media">
                {department.image ? (
                  <img src={department.image} alt={department.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--public-primary)]">
                    <HeartPulse className="h-12 w-12" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="public-card-body">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                    <Stethoscope className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{department.name}</h2>
                    <p className="public-card-description mt-2 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">
                      {department.description || "Đội ngũ chuyên môn sẵn sàng tư vấn, tiếp nhận lịch khám và điều phối bác sĩ phù hợp."}
                    </p>
                  </div>
                </div>

                <div className="public-card-actions">
                  {department.slug ? (
                    <Link href={`/departments/${department.slug}`} className="public-button-secondary rounded-xl px-3 py-2.5 text-center text-sm font-semibold">
                      Chi tiết
                    </Link>
                  ) : (
                    <Link href={`/bac-si?departmentId=${department.id}`} className="public-button-secondary rounded-xl px-3 py-2.5 text-center text-sm font-semibold">
                      Bác sĩ
                    </Link>
                  )}
                  <Link href={`/?departmentId=${department.id}#booking`} className="public-button-primary rounded-xl px-3 py-2.5 text-center text-sm font-semibold">
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

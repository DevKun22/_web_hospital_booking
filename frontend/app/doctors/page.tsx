"use client";

/* eslint-disable @next/next/no-img-element */

import { Clock, Search, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicEmptyState, PublicPageHero } from "@/components/public/public-page-layout";
import { usePublicDepartments, usePublicDoctors } from "@/lib/public-lists-query";
import { getPublicDoctorPath } from "@/lib/public-routes";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";
import type { DoctorProfile } from "@/lib/types";

const pageJsonLd = buildCollectionPageJsonLd({
  name: "Đội ngũ bác sĩ",
  description: "Danh sách bác sĩ, chuyên khoa, phí khám và lịch khám trống để đặt lịch trực tuyến.",
  path: "/bac-si",
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const doctorName = (doctor: DoctorProfile) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const firstLetter = (value: string) => value.trim().slice(0, 1).toUpperCase() || "B";

const getInitialDepartmentId = () => {
  if (typeof window === "undefined") return "";

  return new URLSearchParams(window.location.search).get("departmentId") || "";
};

export default function PublicDoctorsPage() {
  const [departmentId, setDepartmentId] = useState(getInitialDepartmentId);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const departmentsQuery = usePublicDepartments();
  const doctorsQuery = usePublicDoctors({
    search: debouncedSearch.trim() || undefined,
    departmentId: departmentId || undefined,
  });
  const departments = useMemo(() => departmentsQuery.data || [], [departmentsQuery.data]);
  const doctors = useMemo(() => doctorsQuery.data || [], [doctorsQuery.data]);
  const loading = doctorsQuery.isLoading || (doctorsQuery.isFetching && !doctors.length);
  const error =
    departmentsQuery.error instanceof Error
      ? departmentsQuery.error.message
      : doctorsQuery.error instanceof Error
        ? doctorsQuery.error.message
        : "";
  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === departmentId),
    [departmentId, departments],
  );

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }} />
      <PublicPageHero
        eyebrow="Đội ngũ bác sĩ"
        title="Chọn bác sĩ phù hợp với nhu cầu khám"
        description="Tìm theo tên, chuyên môn hoặc lọc theo chuyên khoa. Khi chọn bác sĩ, bạn có thể xem lịch trống và chuyển thẳng về form đặt lịch."
      >
          <div className="public-filter-panel grid max-w-4xl gap-3 p-3 md:grid-cols-[minmax(0,1fr)_260px] md:p-4">
            <label className="relative block">
              <span className="sr-only">Tìm bác sĩ</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm bác sĩ, chuyên môn hoặc chuyên khoa"
                className="ui-field w-full py-3 pl-10 pr-3 text-base sm:text-sm"
              />
            </label>
            <select
              aria-label="Lọc bác sĩ theo chuyên khoa"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="ui-field px-3 py-3 text-base sm:text-sm"
            >
              <option value="">Tất cả chuyên khoa</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
      </PublicPageHero>

      <section className="ui-container py-10 sm:py-12">
        {error ? <div className="ui-status-danger mb-4 rounded-xl border px-4 py-3 text-sm" role="alert">{error}</div> : null}

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--public-muted)]" aria-live="polite">
            {loading ? "Đang tải bác sĩ..." : `${doctors.length} bác sĩ${selectedDepartment ? ` thuộc ${selectedDepartment.name}` : ""}`}
          </p>
          {(search || departmentId) ? (
            <button type="button" onClick={() => { setSearch(""); setDepartmentId(""); }} className="text-sm font-semibold text-[var(--public-primary)] hover:text-[var(--public-primary-dark)]">
              Xóa lọc
            </button>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {loading ? Array.from({ length: 6 }).map((_, index) => <DoctorSkeleton key={index} />) : doctors.length ? doctors.map((doctor) => (
            <article key={doctor.id} className="public-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                {doctor.user.avatar ? (
                  <img src={doctor.user.avatar} alt={doctor.user.fullName} loading="lazy" decoding="async" className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-4 ring-[var(--public-primary-soft)]" />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[var(--public-primary-soft)] text-2xl font-semibold text-[var(--public-primary)]">
                    {firstLetter(doctor.user.fullName)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{doctorName(doctor)}</h2>
                  <p className="mt-1 text-sm font-medium text-[var(--public-primary)]">{doctor.department.name}</p>
                  <p className="mt-3 text-lg font-bold text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 rounded-2xl bg-[var(--public-surface-muted)] p-4 text-sm text-[var(--public-muted)] sm:grid-cols-2">
                <p className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-[var(--public-primary)]" aria-hidden="true" />{doctor.specialization || "Khám chuyên khoa"}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--public-primary)]" aria-hidden="true" />{doctor.experience || 0} năm kinh nghiệm</p>
              </div>
              <p className="public-card-description mt-4 line-clamp-2 text-sm leading-6 text-[var(--public-muted)]">{doctor.bio || "Bác sĩ đang tiếp nhận lịch khám và tư vấn theo chuyên khoa."}</p>
              <div className="public-card-actions sm:grid-cols-2">
                <Link href={getPublicDoctorPath(doctor)} className="public-button-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
                  Xem chi tiết
                </Link>
                <Link href={`/?departmentId=${doctor.department.id}&doctorId=${doctor.id}#booking`} className="public-button-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
                  Đặt lịch
                </Link>
              </div>
            </article>
          )) : (
            <div className="lg:col-span-2"><PublicEmptyState>Chưa tìm thấy bác sĩ phù hợp.</PublicEmptyState></div>
          )}
        </div>
      </section>
    </main>
  );
}

function DoctorSkeleton() {
  return (
    <article className="public-card p-4">
      <div className="flex items-start gap-4">
        <span className="skeleton-shimmer h-20 w-20 shrink-0 rounded-md" />
        <div className="flex-1 space-y-3">
          <span className="skeleton-shimmer block h-5 w-2/3 rounded-md" />
          <span className="skeleton-shimmer block h-4 w-1/2 rounded-md" />
          <span className="skeleton-shimmer block h-5 w-28 rounded-md" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <span className="skeleton-shimmer block h-4 w-full rounded-md" />
        <span className="skeleton-shimmer block h-4 w-5/6 rounded-md" />
        <span className="skeleton-shimmer block h-10 w-full rounded-md" />
      </div>
    </article>
  );
}

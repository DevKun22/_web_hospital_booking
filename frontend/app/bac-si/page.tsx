"use client";

/* eslint-disable @next/next/no-img-element */

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PublicBreadcrumb,
  PublicCatalogSection,
  PublicEmptyState,
} from "@/components/public/public-page-layout";
import { getVietnamDateInput } from "@/lib/date";
import {
  usePublicDepartments,
  usePublicDoctorCatalog,
} from "@/lib/public-lists-query";
import { getPublicDoctorPath } from "@/lib/public-routes";
import { PUBLIC_CHATBOT_OPEN_EVENT } from "@/lib/public-ui-events";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";
import type { DoctorProfile } from "@/lib/types";

import { formatCurrency } from "@/lib/format";
const pageJsonLd = buildCollectionPageJsonLd({
  name: "Đội ngũ bác sĩ",
  description:
    "Danh sách bác sĩ, chuyên khoa, phí khám và lịch khám trống để đặt lịch trực tuyến.",
  path: "/bac-si",
});

const pageSize = 9;


const doctorName = (doctor: DoctorProfile) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const firstLetter = (value: string) =>
  value.trim().slice(0, 1).toUpperCase() || "B";
const formatTime = (value: string) => value.slice(0, 5);

const readInitialQuery = (key: string) => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
};

const readInitialPage = () => {
  const value = Number(readInitialQuery("page"));
  return Number.isInteger(value) && value > 0 ? value : 1;
};

const buildPageNumbers = (page: number, totalPages: number) => {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) =>
    start + index,
  );
};

export default function PublicDoctorsPage() {
  const [departmentId, setDepartmentId] = useState(() =>
    readInitialQuery("departmentId"),
  );
  const [search, setSearch] = useState(() => readInitialQuery("search"));
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [minExperience, setMinExperience] = useState(() =>
    readInitialQuery("minExperience"),
  );
  const [availableToday, setAvailableToday] = useState(
    () => readInitialQuery("availableToday") === "true",
  );
  const [sort, setSort] = useState<"NAME_ASC" | "EXPERIENCE_DESC">(() =>
    readInitialQuery("sort") === "EXPERIENCE_DESC"
      ? "EXPERIENCE_DESC"
      : "NAME_ASC",
  );
  const [page, setPage] = useState(readInitialPage);
  const today = getVietnamDateInput();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    else params.delete("search");
    if (departmentId) params.set("departmentId", departmentId);
    else params.delete("departmentId");
    if (minExperience) params.set("minExperience", minExperience);
    else params.delete("minExperience");
    if (availableToday) params.set("availableToday", "true");
    else params.delete("availableToday");
    if (sort !== "NAME_ASC") params.set("sort", sort);
    else params.delete("sort");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");

    const query = params.toString();
    window.history.replaceState(null, "", query ? `/bac-si?${query}` : "/bac-si");
  }, [availableToday, debouncedSearch, departmentId, minExperience, page, sort]);

  const departmentsQuery = usePublicDepartments();
  const doctorsQuery = usePublicDoctorCatalog({
    search: debouncedSearch.trim() || undefined,
    departmentId: departmentId || undefined,
    minExperience: minExperience ? Number(minExperience) : undefined,
    availableToday: availableToday || undefined,
    sort,
    page,
    limit: pageSize,
  });
  const departments = useMemo(
    () => departmentsQuery.data || [],
    [departmentsQuery.data],
  );
  const doctors = useMemo(
    () => doctorsQuery.data?.items || [],
    [doctorsQuery.data?.items],
  );
  const pagination = doctorsQuery.data?.pagination;
  const summary = doctorsQuery.data?.summary;
  const loading = doctorsQuery.isLoading;
  const refreshing = doctorsQuery.isFetching && !loading;
  const error =
    departmentsQuery.error instanceof Error
      ? departmentsQuery.error.message
      : doctorsQuery.error instanceof Error
        ? doctorsQuery.error.message
        : "";
  const selectedDepartment = departments.find(
    (item) => item.id === departmentId,
  );
  const hasActiveFilters = Boolean(
    search || departmentId || minExperience || availableToday || sort !== "NAME_ASC",
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setDepartmentId("");
    setMinExperience("");
    setAvailableToday(false);
    setSort("NAME_ASC");
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    window.setTimeout(() => {
      document
        .getElementById("doctor-results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }}
      />

      <section className="border-b border-[var(--public-border)] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_62%,#f7fbff_100%)]">
        <div className="ui-container py-4 sm:py-6">
          <PublicBreadcrumb current="Đội ngũ bác sĩ" />
          <div className="grid gap-6 rounded-2xl border border-[var(--public-border)] bg-white/95 p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--public-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--public-primary-dark)]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Đội ngũ chuyên gia được công khai
              </p>
              <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                Đội Ngũ Bác Sĩ &amp; Chuyên Gia Đầu Ngành
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)] sm:text-base">
                Khám phá đội ngũ bác sĩ đang tiếp nhận lịch trong hệ thống. Bạn
                có thể đối chiếu chuyên khoa, kinh nghiệm, đánh giá công khai,
                phí khám và khung giờ trước khi lựa chọn.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--public-text-soft)]">
                {[
                  "Thông tin minh bạch",
                  "Giờ trống theo hệ thống",
                  "Xác thực lịch bằng OTP",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Metric
                label="Bác sĩ công khai"
                value={pagination?.total}
                note="Theo bộ lọc hiện tại"
              />
              <Metric
                label="Chuyên khoa"
                value={departments.length || undefined}
                note="Đang hoạt động"
              />
              <Metric
                label="Có lịch hôm nay"
                value={summary?.doctorsWithTodaySlots}
                note="Khung giờ còn hiệu lực"
                positive
              />
              <Metric
                label="Đánh giá công khai"
                value={summary?.publicReviewCount}
                note="Đã qua kiểm duyệt"
              />
            </dl>
          </div>
        </div>
      </section>

      <section className="ui-container pt-5 sm:pt-7" aria-label="Bộ lọc bác sĩ">
        <div className="rounded-2xl border border-[var(--public-border)] bg-white p-3 shadow-sm sm:p-4">
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setDebouncedSearch(search.trim());
              setPage(1);
            }}
          >
            <label className="relative block">
              <span className="sr-only">Tìm bác sĩ</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Nhập tên bác sĩ, chức danh, chuyên môn hoặc chuyên khoa"
                className="ui-field w-full py-3 pl-10 pr-3 text-base sm:text-sm"
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Tìm kiếm
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Đặt lại
            </button>
          </form>

          <div className="mt-4 grid gap-3 border-t border-[var(--public-divider)] pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--public-text-soft)]">
                Chuyên khoa
              </span>
              <select
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setPage(1);
                }}
                className="ui-field w-full px-3 py-2.5 text-base sm:text-sm"
              >
                <option value="">Tất cả chuyên khoa</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--public-text-soft)]">
                Kinh nghiệm
              </span>
              <select
                value={minExperience}
                onChange={(event) => {
                  setMinExperience(event.target.value);
                  setPage(1);
                }}
                className="ui-field w-full px-3 py-2.5 text-base sm:text-sm"
              >
                <option value="">Tất cả mức kinh nghiệm</option>
                <option value="5">Từ 5 năm</option>
                <option value="10">Từ 10 năm</option>
                <option value="15">Từ 15 năm</option>
                <option value="20">Từ 20 năm</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--public-text-soft)]">
                Thời gian có lịch trống
              </span>
              <select
                value={availableToday ? "TODAY" : "ALL"}
                onChange={(event) => {
                  setAvailableToday(event.target.value === "TODAY");
                  setPage(1);
                }}
                className="ui-field w-full px-3 py-2.5 text-base sm:text-sm"
              >
                <option value="ALL">Không giới hạn</option>
                <option value="TODAY">Có lịch hôm nay</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--public-text-soft)]">
                Sắp xếp theo
              </span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as typeof sort);
                  setPage(1);
                }}
                className="ui-field w-full px-3 py-2.5 text-base sm:text-sm"
              >
                <option value="NAME_ASC">Tên bác sĩ A–Z</option>
                <option value="EXPERIENCE_DESC">Kinh nghiệm cao nhất</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--public-divider)] pt-3">
            <span className="mr-1 text-xs font-semibold text-[var(--public-muted)]">
              Lọc nhanh:
            </span>
            <QuickFilter
              active={availableToday}
              onClick={() => {
                setAvailableToday((current) => !current);
                setPage(1);
              }}
            >
              Có lịch hôm nay
            </QuickFilter>
            {departments.slice(0, 3).map((item) => (
              <QuickFilter
                key={item.id}
                active={departmentId === item.id}
                onClick={() => {
                  setDepartmentId((current) =>
                    current === item.id ? "" : item.id,
                  );
                  setPage(1);
                }}
              >
                {item.name}
              </QuickFilter>
            ))}
          </div>
        </div>
      </section>

      <PublicCatalogSection
        status={
          loading
            ? "Đang tải bác sĩ..."
            : `${pagination?.total || 0} bác sĩ${selectedDepartment ? ` thuộc ${selectedDepartment.name}` : ""}${refreshing ? " · Đang cập nhật" : ""}`
        }
        error={error}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      >
        <div
          id="doctor-results"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          aria-busy={refreshing}
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <DoctorSkeleton key={index} />
            ))
          ) : doctors.length ? (
            doctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} today={today} />
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <PublicEmptyState>
                Chưa tìm thấy bác sĩ phù hợp. Hãy thử từ khóa hoặc chuyên khoa
                khác.
              </PublicEmptyState>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 ? (
          <nav
            className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--public-divider)] pt-5"
            aria-label="Phân trang danh sách bác sĩ"
          >
            <p className="text-sm text-[var(--public-muted)]">
              Trang {pagination.page} / {pagination.totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <PageButton
                label="Trang trước"
                disabled={pagination.page <= 1}
                onClick={() => changePage(Math.max(1, pagination.page - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </PageButton>
              {buildPageNumbers(
                pagination.page,
                pagination.totalPages,
              ).map((pageNumber) => (
                <PageButton
                  key={pageNumber}
                  label={`Trang ${pageNumber}`}
                  active={pageNumber === pagination.page}
                  onClick={() => changePage(pageNumber)}
                >
                  {pageNumber}
                </PageButton>
              ))}
              <PageButton
                label="Trang sau"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  changePage(
                    Math.min(pagination.totalPages, pagination.page + 1),
                  )
                }
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </PageButton>
            </div>
          </nav>
        ) : null}
      </PublicCatalogSection>

      <section className="ui-container pb-10 sm:pb-14">
        <div className="grid gap-5 rounded-2xl border border-[var(--public-border)] bg-[var(--public-primary-soft)]/55 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--public-primary)]">
              Cần hỗ trợ lựa chọn?
            </p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">
              Chưa rõ nên chọn bác sĩ hay chuyên khoa nào?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">
              Trợ lý đặt lịch có thể gợi ý chuyên khoa từ nhu cầu ban đầu và
              đưa bạn đến đúng danh sách bác sĩ đang công khai.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event(PUBLIC_CHATBOT_OPEN_EVENT))
            }
            className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            Nhờ trợ lý hỗ trợ
          </button>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  positive = false,
}: {
  label: string;
  value?: number;
  note: string;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--public-border)] border-t-2 bg-white p-3 shadow-sm ${positive ? "border-t-[var(--public-success)]" : "border-t-[var(--public-primary)]"}`}
    >
      <dt className="text-xs font-semibold text-[var(--public-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-2xl font-bold tabular-nums ${positive ? "text-[var(--public-success)]" : "text-[var(--public-primary)]"}`}
      >
        {value ?? "—"}
      </dd>
      <dd className="mt-1 text-[10px] leading-4 text-[var(--public-muted)]">
        {note}
      </dd>
    </div>
  );
}

function QuickFilter({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
          : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function DoctorCard({ doctor, today }: { doctor: DoctorProfile; today: string }) {
  const slots = doctor.todayAvailableSlots || [];
  const reviewCount = doctor.reviewSummary?.count || 0;
  const averageRating = doctor.reviewSummary?.averageRating || 0;

  return (
    <article className="public-card flex h-full flex-col overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {doctor.user.avatar ? (
            <img
              src={doctor.user.avatar}
              alt={doctor.user.fullName}
              loading="lazy"
              decoding="async"
              className="h-20 w-20 rounded-xl object-cover ring-2 ring-[var(--public-primary-soft)]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-2xl font-bold text-[var(--public-primary)]">
              {firstLetter(doctor.user.fullName)}
            </div>
          )}
          <span
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-[var(--public-success)]"
            title="Đang nhận lịch"
            aria-label="Đang nhận lịch"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--public-primary)]">
            {doctor.department.name}
          </p>
          <h2 className="mt-1 line-clamp-2 text-base font-bold leading-5 text-[var(--public-ink)] sm:text-lg">
            <Link
              href={getPublicDoctorPath(doctor)}
              className="hover:text-[var(--public-primary)]"
            >
              {doctorName(doctor)}
            </Link>
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">
            {doctor.experience || 0} năm kinh nghiệm
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--public-text-soft)]">
            <Star
              className={`h-3.5 w-3.5 ${reviewCount ? "fill-[var(--public-warning)] text-[var(--public-warning)]" : "text-[var(--public-muted)]"}`}
              aria-hidden="true"
            />
            {reviewCount
              ? `${averageRating.toFixed(1)} (${reviewCount} đánh giá)`
              : "Chưa có đánh giá công khai"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[var(--public-primary)]">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
          Chuyên môn
        </p>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--public-text-soft)]">
          {doctor.specialization || "Khám và tư vấn theo chuyên khoa"}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--public-border)] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold text-[var(--public-text-soft)]">
            <CalendarDays
              className="h-4 w-4 text-[var(--public-primary)]"
              aria-hidden="true"
            />
            Giờ trống hôm nay
          </p>
          {slots.length ? (
            <span className="rounded-full bg-[var(--public-success-soft)] px-2 py-1 text-[10px] font-bold text-[var(--public-success)]">
              Còn {slots.length} giờ
            </span>
          ) : null}
        </div>
        {slots.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((slot) => (
              <Link
                key={slot.id}
                href={`/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}&date=${today}&timeSlotId=${slot.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--public-success-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--public-success)] hover:ring-2 hover:ring-[var(--public-success)]/20"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatTime(slot.startTime)}
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href={getPublicDoctorPath(doctor)}
            className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[var(--public-primary)] hover:underline"
          >
            Xem lịch khả dụng theo ngày
            <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-[var(--public-divider)] pt-4">
          <span className="text-xs text-[var(--public-muted)]">Phí khám dự kiến</span>
          <strong className="text-lg tabular-nums text-[var(--public-primary-dark)]">
            {formatCurrency(doctor.consultationFee)}
          </strong>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={getPublicDoctorPath(doctor)}
            className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-bold sm:text-sm"
          >
            Xem hồ sơ
          </Link>
          <Link
            href={`/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`}
            className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-bold sm:text-sm"
          >
            Đặt lịch
          </Link>
        </div>
      </div>
    </article>
  );
}

function PageButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
          : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function DoctorSkeleton() {
  return (
    <article className="public-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="skeleton-shimmer h-20 w-20 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-3">
          <span className="skeleton-shimmer block h-4 w-1/2 rounded" />
          <span className="skeleton-shimmer block h-5 w-5/6 rounded" />
          <span className="skeleton-shimmer block h-4 w-2/3 rounded" />
        </div>
      </div>
      <span className="skeleton-shimmer mt-4 block h-20 w-full rounded-xl" />
      <span className="skeleton-shimmer mt-3 block h-20 w-full rounded-xl" />
      <span className="skeleton-shimmer mt-4 block h-11 w-full rounded-xl" />
    </article>
  );
}

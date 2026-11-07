"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowRight, CalendarDays, HeartPulse, PackageCheck, ShieldCheck, Star, Stethoscope, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PublicCatalogSearch, PublicPagination } from "@/components/public/public-catalog-controls";
import { PublicBreadcrumb, PublicEmptyState } from "@/components/public/public-page-layout";
import type { PublicDepartmentCatalogItem } from "@/components/public/public-home-types";
import { usePublicDepartmentCatalog } from "@/lib/public-lists-query";
import { openPublicChatbot } from "@/lib/public-ui-events";

const PAGE_SIZE = 8;

export function DepartmentCatalogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [available, setAvailable] = useState(searchParams.get("available") === "true");
  const [sort, setSort] = useState<"POPULAR_DESC" | "NAME_ASC">(
    searchParams.get("sort") === "NAME_ASC" ? "NAME_ASC" : "POPULAR_DESC",
  );
  const [page, setPage] = useState(() => Math.max(Number(searchParams.get("page")) || 1, 1));

  const catalogQuery = usePublicDepartmentCatalog({
    search: search || undefined,
    available: available || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const data = catalogQuery.data;
  const items = useMemo(() => data?.items || [], [data?.items]);
  const loading = catalogQuery.isLoading;
  const error = catalogQuery.error instanceof Error ? catalogQuery.error.message : "";
  const hasActiveFilters = Boolean(search || available || sort !== "POPULAR_DESC");
  const quickSymptoms = useMemo(
    () => Array.from(new Set(items.flatMap((item) => item.symptomKeywords || []))).filter(Boolean).slice(0, 5),
    [items],
  );

  const syncUrl = (next: { search?: string; available?: boolean; sort?: "POPULAR_DESC" | "NAME_ASC"; page?: number }) => {
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.available) params.set("available", "true");
    if (next.sort && next.sort !== "POPULAR_DESC") params.set("sort", next.sort);
    if ((next.page || 1) > 1) params.set("page", String(next.page));
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  const applySearch = (value = searchDraft.trim()) => {
    setSearch(value);
    setSearchDraft(value);
    setPage(1);
    syncUrl({ search: value, available, sort, page: 1 });
  };

  const reset = () => {
    setSearchDraft("");
    setSearch("");
    setAvailable(false);
    setSort("POPULAR_DESC");
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  const changeAvailable = (next: boolean) => {
    setAvailable(next);
    setPage(1);
    syncUrl({ search, available: next, sort, page: 1 });
  };

  const changeSort = (next: "POPULAR_DESC" | "NAME_ASC") => {
    setSort(next);
    setPage(1);
    syncUrl({ search, available, sort: next, page: 1 });
  };

  const changePage = (next: number) => {
    setPage(next);
    syncUrl({ search, available, sort, page: next });
    window.scrollTo({ top: 420, behavior: "smooth" });
  };

  return (
    <>
      <section className="border-b border-[var(--public-border)] bg-[linear-gradient(135deg,#ffffff_0%,#f2f6ff_58%,#eefbf7_100%)]">
        <div className="ui-container py-5 sm:py-7 lg:py-9">
          <PublicBreadcrumb current="Chuyên khoa" />
          <div className="grid gap-6 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--public-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--public-primary-dark)]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Danh mục được đồng bộ từ hệ thống
              </span>
              <h1 className="mt-4 max-w-3xl text-[1.65rem] font-bold leading-tight tracking-[-0.03em] sm:text-4xl">Tìm đúng chuyên khoa theo nhu cầu khám</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--public-muted)] sm:text-base sm:leading-7">Tra cứu chuyên khoa, bác sĩ, gói khám và lịch đang tiếp nhận. Bạn cũng có thể tìm bằng triệu chứng đã được cấu hình cho từng chuyên khoa.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--public-muted)]">
                <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">Dữ liệu công khai có kiểm soát</span>
                <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">Lịch cập nhật từ hệ thống</span>
                <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">Tìm theo triệu chứng</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3" aria-label="Thống kê chuyên khoa">
              <Metric icon={HeartPulse} value={data?.summary.departmentCount} label="Chuyên khoa" loading={loading} />
              <Metric icon={UsersRound} value={data?.summary.doctorCount} label="Bác sĩ có lịch" loading={loading} />
              <Metric icon={PackageCheck} value={data?.summary.packageCount} label="Gói khám" loading={loading} />
              <Metric icon={CalendarDays} value={data?.summary.departmentsWithSlots} label="Khoa có lịch" loading={loading} positive />
            </div>
          </div>

          <div className="mt-5">
            <PublicCatalogSearch value={searchDraft} onChange={setSearchDraft} onSubmit={() => applySearch()} onReset={reset} canReset={hasActiveFilters || Boolean(searchDraft)} placeholder="Tìm theo tên chuyên khoa hoặc triệu chứng...">
              <div className="grid gap-3 border-t border-[var(--public-border)] pt-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--public-muted)]">Lọc nhanh</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip selected={available} onClick={() => changeAvailable(!available)}>Có lịch tiếp nhận</FilterChip>
                    {quickSymptoms.map((symptom) => <FilterChip key={symptom} selected={search === symptom} onClick={() => applySearch(search === symptom ? "" : symptom)}>{symptom}</FilterChip>)}
                  </div>
                </div>
                <label className="block text-xs font-semibold text-[var(--public-muted)]">Sắp xếp
                  <select value={sort} onChange={(event) => changeSort(event.target.value as "POPULAR_DESC" | "NAME_ASC")} className="ui-field mt-2 min-h-11 w-full bg-white text-sm font-medium text-[var(--public-ink)]">
                    <option value="POPULAR_DESC">Phù hợp nhất</option>
                    <option value="NAME_ASC">Tên A–Z</option>
                  </select>
                </label>
              </div>
            </PublicCatalogSearch>
          </div>
        </div>
      </section>

      <section className="ui-container py-8 sm:py-10" aria-busy={catalogQuery.isFetching}>
        {error ? <div className="ui-status-danger mb-5 rounded-xl border px-4 py-3 text-sm" role="alert">{error}</div> : null}
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--public-muted)]" aria-live="polite">{loading ? "Đang tải chuyên khoa..." : <>Hiển thị <strong className="text-[var(--public-ink)]">{items.length}</strong> trong tổng số <strong className="text-[var(--public-ink)]">{data?.pagination.total || 0}</strong> chuyên khoa phù hợp</>}</p>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#087a55]"><span className="h-2 w-2 rounded-full bg-[#17a673]" />Dữ liệu lịch được đồng bộ từ hệ thống</span>
        </div>
        <div className={`grid gap-4 lg:grid-cols-2 ${catalogQuery.isFetching && !loading ? "opacity-70" : ""}`}>
          {loading ? Array.from({ length: 6 }).map((_, index) => <DepartmentSkeleton key={index} />) : items.map((department, index) => <DepartmentCard key={department.id} department={department} index={index} />)}
        </div>
        {!loading && !items.length ? <PublicEmptyState>Không tìm thấy chuyên khoa phù hợp. Hãy thử tên khác, mô tả triệu chứng ngắn hơn hoặc nhờ trợ lý AI hỗ trợ phân khoa.</PublicEmptyState> : null}
        <PublicPagination page={data?.pagination.page || page} totalPages={data?.pagination.totalPages || 0} onPageChange={changePage} />
      </section>

      <section className="border-y border-[var(--public-border)] bg-[#eef4ff]">
        <div className="ui-container grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">Hỗ trợ lựa chọn chuyên khoa</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] sm:text-3xl">Chưa biết triệu chứng của bạn thuộc chuyên khoa nào?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)] sm:text-base">Trợ lý AI có thể gợi ý chuyên khoa từ triệu chứng mô tả. Kết quả chỉ mang tính điều hướng và không thay thế chẩn đoán của bác sĩ.</p>
          </div>
          <button type="button" onClick={openPublicChatbot} className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold">Nhờ trợ lý AI hỗ trợ<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, value, label, loading, positive = false }: { icon: typeof HeartPulse; value?: number; label: string; loading: boolean; positive?: boolean }) {
  return <div className={`rounded-xl border border-[var(--public-border)] bg-white p-4 ${positive ? "border-t-2 border-t-[#17a673]" : "border-t-2 border-t-[var(--public-primary)]"}`}><Icon className={`h-5 w-5 ${positive ? "text-[#087a55]" : "text-[var(--public-primary)]"}`} aria-hidden="true" />{loading ? <span className="skeleton-shimmer mt-3 block h-7 w-12 rounded" /> : <strong className="mt-2 block text-2xl tabular-nums">{value ?? 0}</strong>}<span className="mt-1 block text-xs leading-5 text-[var(--public-muted)]">{label}</span></div>;
}

function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${selected ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : "border-[var(--public-border)] bg-white text-[var(--public-ink)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"}`}>{children}</button>;
}

function DepartmentCard({ department, index }: { department: PublicDepartmentCatalogItem; index: number }) {
  const tones = ["#eef4ff", "#eafaf5", "#fff6e8", "#f5efff"];
  const detailUrl = department.slug ? `/chuyen-khoa/${department.slug}` : `/bac-si?departmentId=${department.id}`;
  return (
    <article className="public-card flex min-h-[310px] flex-col p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: tones[index % tones.length] }}>
          {department.image ? <img src={department.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Stethoscope className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-bold leading-6 sm:text-xl">{department.name}</h2>{department.availableSlotCount > 0 ? <span className="rounded-full bg-[#e9f9f3] px-2.5 py-1 text-[11px] font-semibold text-[#087a55]">Có lịch tiếp nhận</span> : null}</div><p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">{department.description || "Thông tin chuyên khoa đang được cập nhật."}</p></div>
      </div>
      <div className="mt-4 rounded-xl bg-[var(--public-surface-muted)] p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--public-primary)]">Nhu cầu khám thường gặp</p><div className="mt-2 flex flex-wrap gap-1.5">{(department.symptomKeywords || []).slice(0, 3).map((keyword) => <span key={keyword} className="rounded-md border border-[var(--public-border)] bg-white px-2 py-1 text-xs text-[var(--public-muted)]">{keyword}</span>)}{!department.symptomKeywords?.length ? <span className="text-xs text-[var(--public-muted)]">Xem mô tả chi tiết để lựa chọn phù hợp.</span> : null}</div></div>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--public-border)] border-y border-[var(--public-border)] py-3 text-center"><div><dt className="text-[11px] text-[var(--public-muted)]">Bác sĩ</dt><dd className="mt-1 font-bold tabular-nums">{department.doctorCount}</dd></div><div><dt className="text-[11px] text-[var(--public-muted)]">Gói khám</dt><dd className="mt-1 font-bold tabular-nums">{department.packageCount}</dd></div><div><dt className="text-[11px] text-[var(--public-muted)]">Đánh giá</dt><dd className="mt-1 inline-flex items-center gap-1 font-bold tabular-nums">{department.reviewSummary.count ? department.reviewSummary.averageRating.toFixed(1) : "—"}{department.reviewSummary.count ? <Star className="h-3.5 w-3.5 fill-[#f2a900] text-[#f2a900]" aria-hidden="true" /> : null}</dd></div></dl>
      <div className="mt-auto grid grid-cols-1 gap-2 pt-4 sm:grid-cols-2"><Link href={detailUrl} className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">Xem chi tiết</Link><Link href={`/dat-lich?departmentId=${department.id}`} className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">Đặt lịch khám</Link></div>
    </article>
  );
}

function DepartmentSkeleton() {
  return <article className="public-card space-y-4 p-5 sm:p-6"><div className="flex gap-3"><span className="skeleton-shimmer h-12 w-12 rounded-xl" /><div className="flex-1 space-y-2"><span className="skeleton-shimmer block h-5 w-2/3 rounded" /><span className="skeleton-shimmer block h-4 w-full rounded" /><span className="skeleton-shimmer block h-4 w-5/6 rounded" /></div></div><span className="skeleton-shimmer block h-20 rounded-xl" /><span className="skeleton-shimmer block h-14 rounded-xl" /><span className="skeleton-shimmer block h-11 rounded-xl" /></article>;
}

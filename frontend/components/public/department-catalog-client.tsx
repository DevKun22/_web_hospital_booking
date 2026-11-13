"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PublicCatalogSearch, PublicPagination } from "@/components/public/public-catalog-controls";
import { CatalogHeader, ChatbotHint, FilterChip, FIELD_LABEL_CLASS, ResultCount, RowList, RowSkeleton, SELECT_CLASS } from "@/components/public/catalog-parts";
import { PublicEmptyState } from "@/components/public/public-page-layout";
import type { PublicDepartmentCatalogItem } from "@/components/public/public-home-types";
import { usePublicDepartmentCatalog } from "@/lib/public-lists-query";

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
      <CatalogHeader current="Chuyên khoa" title="Chuyên khoa" description="Chọn chuyên khoa theo nhu cầu khám. Có thể tìm bằng tên khoa hoặc triệu chứng.">
        <PublicCatalogSearch value={searchDraft} onChange={setSearchDraft} onSubmit={() => applySearch()} onReset={reset} canReset={hasActiveFilters || Boolean(searchDraft)} placeholder="Tên chuyên khoa hoặc triệu chứng, ví dụ: đau đầu">
          <div className="grid gap-3 border-t border-[var(--public-border)] pt-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
            <div>
              <p className={FIELD_LABEL_CLASS}>Lọc nhanh</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <FilterChip selected={available} onClick={() => changeAvailable(!available)}>Đang có lịch trống</FilterChip>
                {quickSymptoms.map((symptom) => (
                  <FilterChip key={symptom} selected={search === symptom} onClick={() => applySearch(search === symptom ? "" : symptom)}>{symptom}</FilterChip>
                ))}
              </div>
            </div>
            <label className={FIELD_LABEL_CLASS}>
              Sắp xếp
              <select value={sort} onChange={(event) => changeSort(event.target.value as "POPULAR_DESC" | "NAME_ASC")} className={SELECT_CLASS}>
                <option value="POPULAR_DESC">Phù hợp nhất</option>
                <option value="NAME_ASC">Tên A–Z</option>
              </select>
            </label>
          </div>
        </PublicCatalogSearch>
      </CatalogHeader>

      <section className="ui-container py-6 sm:py-8" aria-busy={catalogQuery.isFetching}>
        {error ? <p className="mb-4 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]" role="alert">{error}</p> : null}
        <div className="mb-3">
          <ResultCount loading={loading} shown={items.length} total={data?.pagination.total || 0} noun="chuyên khoa" />
        </div>
        {loading ? (
          <RowSkeleton />
        ) : items.length ? (
          <RowList busy={catalogQuery.isFetching}>
            {items.map((department) => <DepartmentRow key={department.id} department={department} />)}
          </RowList>
        ) : (
          <PublicEmptyState>Không tìm thấy chuyên khoa phù hợp. Thử tên khác hoặc mô tả triệu chứng ngắn hơn.</PublicEmptyState>
        )}
        <PublicPagination page={data?.pagination.page || page} totalPages={data?.pagination.totalPages || 0} onPageChange={changePage} />
        <ChatbotHint>Chưa biết triệu chứng của bạn thuộc khoa nào?</ChatbotHint>
      </section>
    </>
  );
}

function DepartmentRow({ department }: { department: PublicDepartmentCatalogItem }) {
  const detailUrl = department.slug ? `/chuyen-khoa/${department.slug}` : `/bac-si?departmentId=${department.id}`;
  const meta = [`${department.doctorCount} bác sĩ`, `${department.packageCount} gói khám`, department.reviewSummary.count ? `${department.reviewSummary.averageRating.toFixed(1)} sao (${department.reviewSummary.count})` : ""].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold"><Link href={detailUrl} className="hover:text-[var(--public-primary)]">{department.name}</Link></h2>
        <p className="mt-0.5 line-clamp-2 text-base text-[var(--public-text-soft)]">{department.description || "Thông tin chuyên khoa đang được cập nhật."}</p>
        <p className="mt-1.5 text-sm text-[var(--public-muted)]">
          {meta}
          {department.availableSlotCount > 0 ? <span className="ml-2 font-semibold text-[var(--public-success)]">Có lịch trống</span> : null}
        </p>
        {department.symptomKeywords?.length ? <p className="mt-1 text-sm text-[var(--public-muted)]">Thường khám: {department.symptomKeywords.slice(0, 4).join(", ")}</p> : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={detailUrl} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Chi tiết</Link>
        <Link href={`/dat-lich?departmentId=${department.id}`} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Đặt lịch</Link>
      </div>
    </li>
  );
}

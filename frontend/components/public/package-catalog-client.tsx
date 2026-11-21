"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PublicCatalogSearch, PublicPagination } from "@/components/public/public-catalog-controls";
import { CatalogHeader, ChatbotHint, ChipRow, FilterChip, FlatSelect, ResultCount } from "@/components/public/catalog-parts";
import { PublicEmptyState } from "@/components/public/public-page-layout";
import { usePublicPackageCatalog } from "@/lib/public-lists-query";
import { PackageCard } from "@/features/packages/components/package-card";

import { formatCurrency } from "@/lib/format";
const PAGE_SIZE = 9;
type PackageKind = "ALL" | "POPULAR" | "BHYT";
type PackageSort = "POPULAR_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC";


export function PackageCatalogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialKind = normalizeKind(searchParams.get("loai"));
  const initialSort = normalizeSort(searchParams.get("sap-xep"));
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [kind, setKind] = useState<PackageKind>(initialKind);
  const [departmentId, setDepartmentId] = useState(searchParams.get("chuyen-khoa") || "");
  const [sort, setSort] = useState<PackageSort>(initialSort);
  const [page, setPage] = useState(() => Math.max(Number(searchParams.get("trang")) || 1, 1));

  const catalogQuery = usePublicPackageCatalog({
    search: search || undefined,
    departmentId: departmentId || undefined,
    isPopular: kind === "POPULAR" ? true : undefined,
    isBHYTSupport: kind === "BHYT" ? true : undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const data = catalogQuery.data;
  const items = useMemo(() => data?.items || [], [data?.items]);
  const loading = catalogQuery.isLoading;
  const error = catalogQuery.error instanceof Error ? catalogQuery.error.message : "";
  const hasActiveFilters = Boolean(search || departmentId || kind !== "ALL" || sort !== "POPULAR_DESC");

  const syncUrl = (next: {
    search?: string;
    kind?: PackageKind;
    departmentId?: string;
    sort?: PackageSort;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.kind && next.kind !== "ALL") params.set("loai", next.kind);
    if (next.departmentId) params.set("chuyen-khoa", next.departmentId);
    if (next.sort && next.sort !== "POPULAR_DESC") params.set("sap-xep", next.sort);
    if ((next.page || 1) > 1) params.set("trang", String(next.page));
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  const applySearch = (value = searchDraft.trim()) => {
    setSearchDraft(value);
    setSearch(value);
    setPage(1);
    syncUrl({ search: value, kind, departmentId, sort, page: 1 });
  };

  const changeKind = (next: PackageKind) => {
    setKind(next);
    setPage(1);
    syncUrl({ search, kind: next, departmentId, sort, page: 1 });
  };

  const changeDepartment = (next: string) => {
    setDepartmentId(next);
    setPage(1);
    syncUrl({ search, kind, departmentId: next, sort, page: 1 });
  };

  const changeSort = (next: PackageSort) => {
    setSort(next);
    setPage(1);
    syncUrl({ search, kind, departmentId, sort: next, page: 1 });
  };

  const changePage = (next: number) => {
    setPage(next);
    syncUrl({ search, kind, departmentId, sort, page: next });
    window.scrollTo({ top: 520, behavior: "smooth" });
  };

  const reset = () => {
    setSearchDraft("");
    setSearch("");
    setKind("ALL");
    setDepartmentId("");
    setSort("POPULAR_DESC");
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  return (
    <>
      <CatalogHeader current="Gói khám" title="Gói khám" description="Xem hạng mục, chuyên khoa và mức phí từng gói, rồi đặt lịch theo gói bạn chọn.">
        <PublicCatalogSearch
          value={searchDraft}
          onChange={setSearchDraft}
          onSubmit={() => applySearch()}
          onReset={reset}
          canReset={hasActiveFilters || Boolean(searchDraft)}
          placeholder="Tìm gói khám, chuyên khoa hoặc hạng mục"
          controls={
            <>
              <FlatSelect label="Chuyên khoa" value={departmentId} onChange={changeDepartment}>
                <option value="">Tất cả chuyên khoa</option>
                {(data?.filters.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </FlatSelect>
              <FlatSelect label="Sắp xếp" value={sort} onChange={(next) => changeSort(next as PackageSort)}>
                <option value="POPULAR_DESC">Gói nổi bật trước</option>
                <option value="PRICE_ASC">Giá thấp đến cao</option>
                <option value="PRICE_DESC">Giá cao đến thấp</option>
                <option value="NAME_ASC">Tên A–Z</option>
              </FlatSelect>
            </>
          }
        >
          <ChipRow label="Loại gói">
            <FilterChip selected={kind === "ALL"} onClick={() => changeKind("ALL")}>Tất cả</FilterChip>
            <FilterChip selected={kind === "POPULAR"} onClick={() => changeKind("POPULAR")}>Gói nổi bật</FilterChip>
            <FilterChip selected={kind === "BHYT"} onClick={() => changeKind("BHYT")}>Hỗ trợ BHYT</FilterChip>
          </ChipRow>
        </PublicCatalogSearch>

      </CatalogHeader>

      <section className="ui-container py-6 sm:py-8" aria-busy={catalogQuery.isFetching}>
        {error ? <p className="mb-4 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]" role="alert">{error}</p> : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <ResultCount loading={loading} shown={items.length} total={data?.pagination.total || 0} noun="gói khám" />
          {data?.summary.packageCount ? <p className="text-sm text-[var(--public-muted)]">Giá từ {formatCurrency(data.summary.minPrice)} đến {formatCurrency(data.summary.maxPrice)}</p> : null}
        </div>
        {loading ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => <li key={index}><span className="skeleton-shimmer block h-80 rounded-2xl" /></li>)}
          </ul>
        ) : items.length ? (
          <ul aria-busy={catalogQuery.isFetching} className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${catalogQuery.isFetching ? "opacity-70" : ""}`}>
            {items.map((item) => <li key={item.id}><PackageCard item={item} /></li>)}
          </ul>
        ) : (
          <PublicEmptyState>Không tìm thấy gói khám phù hợp. Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc.</PublicEmptyState>
        )}
        <PublicPagination page={data?.pagination.page || page} totalPages={data?.pagination.totalPages || 0} onPageChange={changePage} />
        <ChatbotHint>Chưa biết nên chọn gói nào?</ChatbotHint>
      </section>
    </>
  );
}

function normalizeKind(value: string | null): PackageKind {
  return value === "POPULAR" || value === "BHYT" ? value : "ALL";
}

function normalizeSort(value: string | null): PackageSort {
  return value === "PRICE_ASC" || value === "PRICE_DESC" || value === "NAME_ASC" ? value : "POPULAR_DESC";
}

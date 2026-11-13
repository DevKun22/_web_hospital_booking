"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PublicCatalogSearch, PublicPagination } from "@/components/public/public-catalog-controls";
import { CatalogHeader, ChatbotHint, FilterChip, FIELD_LABEL_CLASS, ResultCount, RowList, RowSkeleton, SELECT_CLASS } from "@/components/public/catalog-parts";
import { PublicEmptyState } from "@/components/public/public-page-layout";
import { usePublicPackageCatalog } from "@/lib/public-lists-query";
import type { MedicalPackage } from "@/lib/types";

import { formatCurrency } from "@/lib/format";
const PAGE_SIZE = 6;
type PackageKind = "ALL" | "POPULAR" | "BHYT";
type PackageSort = "POPULAR_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC";


const getBookingUrl = (item: MedicalPackage) => {
  const params = new URLSearchParams({ packageId: item.id });
  if (item.department?.id) params.set("departmentId", item.department.id);
  return `/dat-lich?${params.toString()}`;
};

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
        <PublicCatalogSearch value={searchDraft} onChange={setSearchDraft} onSubmit={() => applySearch()} onReset={reset} canReset={hasActiveFilters || Boolean(searchDraft)} placeholder="Tên gói, chuyên khoa hoặc hạng mục khám">
          <div className="grid gap-3 border-t border-[var(--public-border)] pt-3 lg:grid-cols-[minmax(0,1fr)_14rem_14rem] lg:items-end">
            <div>
              <p className={FIELD_LABEL_CLASS}>Loại gói</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <FilterChip selected={kind === "ALL"} onClick={() => changeKind("ALL")}>Tất cả</FilterChip>
                <FilterChip selected={kind === "POPULAR"} onClick={() => changeKind("POPULAR")}>Gói nổi bật</FilterChip>
                <FilterChip selected={kind === "BHYT"} onClick={() => changeKind("BHYT")}>Hỗ trợ BHYT</FilterChip>
              </div>
            </div>
            <label className={FIELD_LABEL_CLASS}>
              Chuyên khoa
              <select value={departmentId} onChange={(event) => changeDepartment(event.target.value)} className={SELECT_CLASS}>
                <option value="">Tất cả chuyên khoa</option>
                {(data?.filters.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label className={FIELD_LABEL_CLASS}>
              Sắp xếp
              <select value={sort} onChange={(event) => changeSort(event.target.value as PackageSort)} className={SELECT_CLASS}>
                <option value="POPULAR_DESC">Phù hợp nhất</option>
                <option value="PRICE_ASC">Giá thấp đến cao</option>
                <option value="PRICE_DESC">Giá cao đến thấp</option>
                <option value="NAME_ASC">Tên A–Z</option>
              </select>
            </label>
          </div>
        </PublicCatalogSearch>
      </CatalogHeader>

      <section className="ui-container py-6 sm:py-8" aria-busy={catalogQuery.isFetching}>
        {error ? <p className="mb-4 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]" role="alert">{error}</p> : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <ResultCount loading={loading} shown={items.length} total={data?.pagination.total || 0} noun="gói khám" />
          {data?.summary.packageCount ? <p className="text-sm text-[var(--public-muted)]">Giá từ {formatCurrency(data.summary.minPrice)} đến {formatCurrency(data.summary.maxPrice)}</p> : null}
        </div>
        {loading ? (
          <RowSkeleton />
        ) : items.length ? (
          <RowList busy={catalogQuery.isFetching}>
            {items.map((item) => <PackageRow key={item.id} item={item} />)}
          </RowList>
        ) : (
          <PublicEmptyState>Không tìm thấy gói khám phù hợp. Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc.</PublicEmptyState>
        )}
        <PublicPagination page={data?.pagination.page || page} totalPages={data?.pagination.totalPages || 0} onPageChange={changePage} />
        <ChatbotHint>Chưa biết nên chọn gói nào?</ChatbotHint>
      </section>
    </>
  );
}

function PackageRow({ item }: { item: MedicalPackage }) {
  const included = item.items.filter((packageItem) => packageItem.included);
  const detailHref = item.slug ? `/goi-kham/${item.slug}` : null;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold">{detailHref ? <Link href={detailHref} className="hover:text-[var(--public-primary)]">{item.name}</Link> : item.name}</h2>
        <p className="mt-0.5 text-sm text-[var(--public-muted)]">
          {item.department?.name || "Đa chuyên khoa"} · {included.length} hạng mục
          {item.isBHYTSupport ? <span className="ml-2 font-semibold text-[var(--public-success)]">Hỗ trợ BHYT</span> : null}
          {item.isPopular ? <span className="ml-2 font-semibold text-[var(--public-warning)]">Nổi bật</span> : null}
        </p>
        <p className="mt-1.5 line-clamp-2 text-base text-[var(--public-text-soft)]">{item.summary || item.description || "Thông tin mô tả gói khám đang được cập nhật."}</p>
        {included.length ? <p className="mt-1.5 line-clamp-2 text-sm text-[var(--public-muted)]">Gồm: {included.slice(0, 4).map((entry) => entry.name).join("; ")}{included.length > 4 ? `; và ${included.length - 4} hạng mục khác` : ""}</p> : null}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
        <p className="text-xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</p>
        <div className="flex gap-2">
          {detailHref ? <Link href={detailHref} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Chi tiết</Link> : null}
          <Link href={getBookingUrl(item)} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Chọn gói</Link>
        </div>
      </div>
    </li>
  );
}

function normalizeKind(value: string | null): PackageKind {
  return value === "POPULAR" || value === "BHYT" ? value : "ALL";
}

function normalizeSort(value: string | null): PackageSort {
  return value === "PRICE_ASC" || value === "PRICE_DESC" || value === "NAME_ASC" ? value : "POPULAR_DESC";
}

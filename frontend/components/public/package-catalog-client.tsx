"use client";

import {
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PublicCatalogSearch, PublicPagination } from "@/components/public/public-catalog-controls";
import { PublicBreadcrumb, PublicEmptyState } from "@/components/public/public-page-layout";
import { usePublicPackageCatalog } from "@/lib/public-lists-query";
import { openPublicChatbot } from "@/lib/public-ui-events";
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
  const comparisonItems = useMemo(() => items.slice(0, 3), [items]);
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
      <section className="border-b border-[var(--public-border)] bg-[linear-gradient(135deg,#ffffff_0%,#f1f5ff_54%,#eefbf7_100%)]">
        <div className="ui-container py-5 sm:py-7 lg:py-9">
          <PublicBreadcrumb current="Gói khám" />
          <div className="grid gap-6 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-soft)] sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--public-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--public-primary-dark)]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Danh mục công khai từ hệ thống
              </span>
              <h1 className="mt-4 max-w-3xl text-[1.65rem] font-bold leading-tight tracking-[-0.03em] sm:text-4xl">
                Gói khám sức khỏe và tầm soát minh bạch chi phí
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--public-muted)] sm:text-base sm:leading-7">
                So sánh hạng mục, chuyên khoa, mức phí và thông tin hỗ trợ BHYT trước khi chuyển sang quy trình đặt lịch.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--public-muted)]">
                <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">Giá tính từ hạng mục đã cấu hình</span>
                <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">Xem chi tiết trước khi đặt</span>
                <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">Đặt lịch theo từng bước</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3" aria-label="Thống kê gói khám">
              <Metric icon={PackageCheck} value={data?.summary.packageCount} label="Gói đang công khai" loading={loading} />
              <Metric icon={Sparkles} value={data?.summary.popularCount} label="Gói nổi bật" loading={loading} />
              <Metric icon={ShieldCheck} value={data?.summary.bhytSupportCount} label="Gói hỗ trợ BHYT" loading={loading} positive />
              <Metric icon={HeartPulse} value={data?.summary.departmentCount} label="Chuyên khoa liên quan" loading={loading} />
            </div>
          </div>

          <div className="mt-5">
            <PublicCatalogSearch
              value={searchDraft}
              onChange={setSearchDraft}
              onSubmit={() => applySearch()}
              onReset={reset}
              canReset={hasActiveFilters || Boolean(searchDraft)}
              placeholder="Tìm theo tên gói, chuyên khoa hoặc hạng mục khám..."
            >
              <div className="grid gap-3 border-t border-[var(--public-border)] pt-3 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-end">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--public-muted)]">Lọc nhanh</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip selected={kind === "ALL"} onClick={() => changeKind("ALL")}>Tất cả</FilterChip>
                    <FilterChip selected={kind === "POPULAR"} onClick={() => changeKind("POPULAR")}>Gói nổi bật</FilterChip>
                    <FilterChip selected={kind === "BHYT"} onClick={() => changeKind("BHYT")}>Hỗ trợ BHYT</FilterChip>
                  </div>
                </div>
                <label className="block text-xs font-semibold text-[var(--public-muted)]">
                  Chuyên khoa
                  <select value={departmentId} onChange={(event) => changeDepartment(event.target.value)} className="ui-field mt-2 min-h-11 w-full bg-white text-sm font-medium text-[var(--public-ink)]">
                    <option value="">Tất cả chuyên khoa</option>
                    {(data?.filters.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[var(--public-muted)]">
                  Sắp xếp
                  <select value={sort} onChange={(event) => changeSort(event.target.value as PackageSort)} className="ui-field mt-2 min-h-11 w-full bg-white text-sm font-medium text-[var(--public-ink)]">
                    <option value="POPULAR_DESC">Phù hợp nhất</option>
                    <option value="PRICE_ASC">Giá thấp đến cao</option>
                    <option value="PRICE_DESC">Giá cao đến thấp</option>
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
          <p className="text-sm text-[var(--public-muted)]" aria-live="polite">
            {loading ? "Đang tải gói khám..." : <>Hiển thị <strong className="text-[var(--public-ink)]">{items.length}</strong> trong tổng số <strong className="text-[var(--public-ink)]">{data?.pagination.total || 0}</strong> gói phù hợp</>}
          </p>
          {data?.summary.packageCount ? <span className="text-xs font-medium text-[var(--public-muted)]">Khoảng giá công khai: {formatCurrency(data.summary.minPrice)} – {formatCurrency(data.summary.maxPrice)}</span> : null}
        </div>
        <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${catalogQuery.isFetching && !loading ? "opacity-70" : ""}`}>
          {loading ? Array.from({ length: 6 }).map((_, index) => <PackageSkeleton key={index} />) : items.map((item) => <PackageCard key={item.id} item={item} />)}
        </div>
        {!loading && !items.length ? <PublicEmptyState>Không tìm thấy gói khám phù hợp. Hãy thử từ khóa ngắn hơn, bỏ bớt bộ lọc hoặc nhờ trợ lý AI hỗ trợ.</PublicEmptyState> : null}
        <PublicPagination page={data?.pagination.page || page} totalPages={data?.pagination.totalPages || 0} onPageChange={changePage} />
      </section>

      {comparisonItems.length >= 2 ? <ComparisonSection items={comparisonItems} /> : null}

      <section className="border-y border-[#1647c7] bg-[linear-gradient(135deg,#0f4fd8_0%,#1749bd_56%,#0d6b83_100%)] text-white">
        <div className="ui-container grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-100">Hỗ trợ chọn gói</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] sm:text-3xl">Chưa biết gói khám nào phù hợp với nhu cầu?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50 sm:text-base">Trợ lý AI có thể giúp tìm gói và chuyên khoa từ thông tin bạn mô tả. Nội dung chỉ mang tính điều hướng, không thay thế tư vấn hoặc chẩn đoán y khoa.</p>
          </div>
          <button type="button" onClick={openPublicChatbot} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#1749bd] shadow-sm transition hover:bg-blue-50">
            Nhờ trợ lý AI gợi ý
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </>
  );
}

function PackageCard({ item }: { item: MedicalPackage }) {
  const includedItems = item.items.filter((packageItem) => packageItem.included);
  const visibleItems = includedItems.slice(0, 4);
  return (
    <article className="public-card flex min-h-[430px] flex-col overflow-hidden p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {item.isPopular ? <span className="ui-status-warning inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold">Gói nổi bật</span> : null}
          {item.isBHYTSupport ? <span className="ui-status-positive inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Hỗ trợ BHYT</span> : null}
        </div>
        <span className="text-xs font-medium text-[var(--public-muted)]">{item.department?.name || "Đa chuyên khoa"}</span>
      </div>
      <h2 className="mt-3 text-lg font-bold leading-6 tracking-[-0.01em]">{item.slug ? <Link href={`/goi-kham/${item.slug}`} className="transition hover:text-[var(--public-primary)]">{item.name}</Link> : item.name}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">{item.summary || item.description || "Thông tin mô tả gói khám đang được cập nhật."}</p>
      <div className="mt-4 rounded-xl bg-[var(--public-surface-muted)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--public-primary)]">Hạng mục đã bao gồm</p>
        <ul className="mt-2 space-y-2">
          {visibleItems.map((packageItem) => <li key={packageItem.id} className="flex items-start gap-2 text-xs leading-5 text-[var(--public-muted)]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" /><span>{packageItem.name}</span></li>)}
          {!visibleItems.length ? <li className="text-xs text-[var(--public-muted)]">Hạng mục chi tiết đang được cập nhật.</li> : null}
        </ul>
        {includedItems.length > visibleItems.length ? <p className="mt-2 text-xs font-semibold text-[var(--public-primary)]">Và {includedItems.length - visibleItems.length} hạng mục khác</p> : null}
      </div>
      <div className="mt-auto border-t border-[var(--public-border)] pt-4">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs text-[var(--public-muted)]">Chi phí dự kiến</p><p className="mt-1 text-2xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</p></div>
          <span className="text-right text-xs text-[var(--public-muted)]">{includedItems.length}<br />hạng mục</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {item.slug ? <Link href={`/goi-kham/${item.slug}`} className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold">Xem chi tiết</Link> : <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--public-border)] text-sm text-[var(--public-muted)]">Chưa có chi tiết</span>}
          <Link href={getBookingUrl(item)} className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold">Chọn gói này</Link>
        </div>
      </div>
    </article>
  );
}

function ComparisonSection({ items }: { items: MedicalPackage[] }) {
  return (
    <section className="border-t border-[var(--public-border)] bg-[#f4f7ff]">
      <div className="ui-container py-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--public-primary)]">Đối chiếu minh bạch</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] sm:text-3xl">So sánh nhanh các gói đang hiển thị</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">Bảng sử dụng trực tiếp mức phí và hạng mục hiện có. Xem trang chi tiết để đọc đầy đủ nội dung từng gói.</p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--public-border)] bg-white shadow-[var(--public-shadow-soft)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">So sánh các gói khám đang hiển thị</caption>
            <thead><tr className="bg-[var(--public-surface-muted)]"><th className="w-48 px-4 py-3 font-semibold">Tiêu chí</th>{items.map((item) => <th key={item.id} className="min-w-48 border-l border-[var(--public-border)] px-4 py-3 font-semibold">{item.name}</th>)}</tr></thead>
            <tbody>
              <ComparisonRow label="Chuyên khoa" items={items} render={(item) => item.department?.name || "Đa chuyên khoa"} />
              <ComparisonRow label="Hạng mục bao gồm" items={items} render={(item) => String(item.items.filter((entry) => entry.included).length)} />
              <ComparisonRow label="Hỗ trợ BHYT" items={items} render={(item) => item.isBHYTSupport ? "Có" : "Không ghi nhận"} />
              <ComparisonRow label="Phí dịch vụ" items={items} render={(item) => formatCurrency(item.serviceFee)} />
              <ComparisonRow label="Chi phí dự kiến" items={items} render={(item) => formatCurrency(item.finalPrice)} strong />
              <tr><th className="px-4 py-4 font-semibold">Hành động</th>{items.map((item) => <td key={item.id} className="border-l border-[var(--public-border)] px-4 py-4"><Link href={getBookingUrl(item)} className="public-button-primary inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold">Chọn gói</Link></td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ComparisonRow({ label, items, render, strong = false }: { label: string; items: MedicalPackage[]; render: (item: MedicalPackage) => string; strong?: boolean }) {
  return <tr className="border-t border-[var(--public-border)]"><th className="px-4 py-3 font-medium text-[var(--public-muted)]">{label}</th>{items.map((item) => <td key={item.id} className={`border-l border-[var(--public-border)] px-4 py-3 ${strong ? "font-bold tabular-nums text-[var(--public-primary-dark)]" : "text-[var(--public-ink)]"}`}>{render(item)}</td>)}</tr>;
}

function Metric({ icon: Icon, value, label, loading, positive = false }: { icon: typeof PackageCheck; value?: number; label: string; loading: boolean; positive?: boolean }) {
  return <div className={`rounded-xl border border-[var(--public-border)] bg-white p-4 ${positive ? "border-t-2 border-t-[#17a673]" : "border-t-2 border-t-[var(--public-primary)]"}`}><Icon className={`h-5 w-5 ${positive ? "text-[#087a55]" : "text-[var(--public-primary)]"}`} aria-hidden="true" />{loading ? <span className="skeleton-shimmer mt-3 block h-7 w-12 rounded" /> : <strong className="mt-2 block text-2xl tabular-nums">{value ?? 0}</strong>}<span className="mt-1 block text-xs leading-5 text-[var(--public-muted)]">{label}</span></div>;
}

function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${selected ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : "border-[var(--public-border)] bg-white text-[var(--public-ink)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"}`}>{children}</button>;
}

function PackageSkeleton() {
  return <article className="public-card space-y-4 p-5"><div className="flex justify-between gap-3"><span className="skeleton-shimmer h-6 w-24 rounded-full" /><span className="skeleton-shimmer h-4 w-24 rounded" /></div><span className="skeleton-shimmer block h-6 w-4/5 rounded" /><span className="skeleton-shimmer block h-16 rounded" /><span className="skeleton-shimmer block h-36 rounded-xl" /><span className="skeleton-shimmer block h-12 rounded-xl" /></article>;
}

function normalizeKind(value: string | null): PackageKind {
  return value === "POPULAR" || value === "BHYT" ? value : "ALL";
}

function normalizeSort(value: string | null): PackageSort {
  return value === "PRICE_ASC" || value === "PRICE_DESC" || value === "NAME_ASC" ? value : "POPULAR_DESC";
}

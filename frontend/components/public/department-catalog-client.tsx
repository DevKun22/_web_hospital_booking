"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { PublicCatalogSearch, PublicPagination } from "@/components/public/public-catalog-controls";
import { CatalogHeader, CatalogStatusBar, ChatbotHint, ChipRow, FilterChip, FlatSelect } from "@/components/public/catalog-parts";
import { PublicEmptyState } from "@/components/public/public-page-layout";
import type { PublicDepartmentCatalogItem } from "@/components/public/public-home-types";
import { toneGradient } from "@/lib/dept-tone";
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
      <CatalogHeader brand current="Chuyên khoa" title="Chuyên khoa" description="Chọn chuyên khoa theo nhu cầu khám, hoặc mô tả triệu chứng để được gợi ý.">
        <PublicCatalogSearch
          value={searchDraft}
          onChange={setSearchDraft}
          onSubmit={() => applySearch()}
          onReset={reset}
          canReset={hasActiveFilters || Boolean(searchDraft)}
          onBrand
          placeholder="Tìm chuyên khoa hoặc triệu chứng"
          controls={
            <FlatSelect label="Sắp xếp" value={sort} onChange={(next) => changeSort(next as "POPULAR_DESC" | "NAME_ASC")}>
              <option value="POPULAR_DESC">Nhiều bác sĩ, gói khám trước</option>
              <option value="NAME_ASC">Tên A–Z</option>
            </FlatSelect>
          }
        >
          <ChipRow label="Lọc nhanh">
            <FilterChip selected={available} onClick={() => changeAvailable(!available)}>Đang có lịch trống</FilterChip>
            {quickSymptoms.map((symptom) => (
              <FilterChip key={symptom} selected={search === symptom} onClick={() => applySearch(search === symptom ? "" : symptom)}>{symptom}</FilterChip>
            ))}
            <button type="button" onClick={() => openPublicChatbot()} className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-white/60 px-3.5 text-sm font-medium text-white transition hover:bg-white/15">Hỏi Kun gợi ý khoa</button>
          </ChipRow>
        </PublicCatalogSearch>

      </CatalogHeader>

      <CatalogStatusBar
        status={loading ? "Đang tải chuyên khoa..." : `${data?.pagination.total || 0} chuyên khoa`}
        chips={[
          ...(search ? [{ key: "search", label: `“${search}”`, onRemove: () => applySearch("") }] : []),
          ...(available ? [{ key: "available", label: "Đang có lịch trống", onRemove: () => changeAvailable(false) }] : []),
        ]}
        onReset={reset}
      />

      <section className="ui-container py-6 sm:py-8" aria-busy={catalogQuery.isFetching}>
        {error ? <p className="mb-4 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]" role="alert">{error}</p> : null}
        {loading ? (
          <CardSkeleton />
        ) : items.length ? (
          <ul aria-busy={catalogQuery.isFetching} className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${catalogQuery.isFetching ? "opacity-70" : ""}`}>
            {items.map((department, index) => <DepartmentCard key={department.id} department={department} index={index} />)}
          </ul>
        ) : (
          <PublicEmptyState>Không tìm thấy chuyên khoa phù hợp. Thử tên khác hoặc mô tả triệu chứng ngắn hơn.</PublicEmptyState>
        )}
        <PublicPagination page={data?.pagination.page || page} totalPages={data?.pagination.totalPages || 0} onPageChange={changePage} />
        <ChatbotHint>Chưa biết triệu chứng của bạn thuộc khoa nào?</ChatbotHint>
      </section>
    </>
  );
}

function CardSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <li key={index} className="overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)]">
          <span className="skeleton-shimmer block aspect-[5/2] w-full" />
          <span className="block space-y-2 p-4">
            <span className="skeleton-shimmer block h-5 w-1/2 rounded" />
            <span className="skeleton-shimmer block h-4 w-4/5 rounded" />
            <span className="skeleton-shimmer block h-4 w-1/3 rounded" />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Thẻ chuyên khoa: ảnh (hoặc ô biểu tượng màu khi chưa có ảnh), tên, mô tả, số liệu thật; cả thẻ là một vùng bấm vào trang chi tiết.
// Còn lịch trống thì nút chính là Đặt lịch; hết lịch thì nút chính đổi thành Xem bác sĩ (không đẩy người dùng vào luồng đặt khi chưa có giờ).
function DepartmentCard({ department, index }: { department: PublicDepartmentCatalogItem; index: number }) {
  const detailUrl = department.slug ? `/chuyen-khoa/${department.slug}` : `/bac-si?departmentId=${department.id}`;
  const hasSlots = department.availableSlotCount > 0;
  const meta = [
    department.doctorCount ? `${department.doctorCount} bác sĩ` : "",
    department.packageCount ? `${department.packageCount} gói khám` : "",
    department.reviewSummary.count ? `${department.reviewSummary.averageRating.toFixed(1)} sao (${department.reviewSummary.count})` : "",
  ].filter(Boolean).join(" · ");
  return (
    <li style={{ "--i": index } as React.CSSProperties} className="catalog-rise group/dept flex flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] transition hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-lg">
      <Link href={detailUrl} tabIndex={-1} aria-hidden="true" className="block aspect-[5/2] overflow-hidden bg-[var(--public-tint-strong)]">
        {department.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={department.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover/dept:scale-105" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" style={{ background: toneGradient(department.name) }}>
            <Stethoscope className="h-10 w-10 text-white/90" aria-hidden="true" />
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <h2 className="text-lg font-semibold leading-snug"><Link href={detailUrl} className="hover:text-[var(--public-primary)]">{department.name}</Link></h2>
        <p className="mt-1 line-clamp-2 text-base leading-7 text-[var(--public-text-soft)]">{department.description || "Thông tin chuyên khoa đang được cập nhật."}</p>
        {meta ? <p className="mt-2 text-sm text-[var(--public-muted)]">{meta}</p> : null}
        <p className="mt-2 text-sm">
          {hasSlots ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--public-success)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--public-success)]" aria-hidden="true" />Có lịch trống</span>
          ) : (
            <span className="text-[var(--public-muted)]">Chưa có lịch trống</span>
          )}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {hasSlots ? (
            <>
              <Link href={`/dat-lich?departmentId=${department.id}`} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Đặt lịch</Link>
              <Link href={detailUrl} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Chi tiết</Link>
            </>
          ) : (
            <>
              <Link href={`/bac-si?departmentId=${department.id}`} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Xem bác sĩ</Link>
              <Link href={detailUrl} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--public-primary)] hover:underline">Chi tiết</Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

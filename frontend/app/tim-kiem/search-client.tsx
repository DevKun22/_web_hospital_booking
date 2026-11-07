"use client";

import { ArrowRight, HelpCircle, Search, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  PublicCatalogSection,
  PublicFilterPanel,
  PublicPageHero,
} from "@/components/public/public-page-layout";
import { HighlightText } from "@/components/public/search-highlight";
import { usePublicSearch, type PublicSearchItem, type PublicSearchType } from "@/lib/public-search-query";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const searchTabs: Array<{ value: PublicSearchType; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "department", label: "Chuyên khoa" },
  { value: "doctor", label: "Bác sĩ" },
  { value: "package", label: "Gói khám" },
  { value: "faq", label: "Câu hỏi" },
];

const typeLabels: Record<PublicSearchItem["type"], string> = {
  department: "Chuyên khoa",
  doctor: "Bác sĩ",
  package: "Gói khám",
  faq: "Câu hỏi",
};

const typeIcons: Record<PublicSearchItem["type"], ReactNode> = {
  department: <Stethoscope className="h-4 w-4" />,
  doctor: <UserRound className="h-4 w-4" />,
  package: <Search className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
};

const formatCurrency = (value?: number | null) =>
  value
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value)
    : "";

const normalizeType = (value: string | null): PublicSearchType =>
  searchTabs.some((item) => item.value === value) ? (value as PublicSearchType) : "all";

export default function SearchClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("q") || "");
  const [type, setType] = useState<PublicSearchType>(normalizeType(searchParams.get("type")));
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const trimmedKeyword = debouncedKeyword.trim();
  const searchQuery = usePublicSearch({ q: trimmedKeyword, type, limit: 30 });
  const items = searchQuery.data?.items || [];
  const shouldSearch = trimmedKeyword.length >= 2;

  useEffect(() => {
    const next = new URLSearchParams();
    if (trimmedKeyword) next.set("q", trimmedKeyword);
    if (type !== "all") next.set("type", type);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, trimmedKeyword, type]);

  const resultLabel = useMemo(() => {
    if (!shouldSearch) return "Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.";
    if (searchQuery.isFetching) return "Đang tìm kiếm dữ liệu phù hợp...";
    if (!items.length) return "Chưa tìm thấy kết quả phù hợp.";

    return `${items.length} kết quả phù hợp`;
  }, [items.length, searchQuery.isFetching, shouldSearch]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">

      <PublicPageHero
        eyebrow="Tìm kiếm"
        title="Tìm nhanh thông tin trước khi đặt lịch"
        description="Tìm chuyên khoa, bác sĩ, gói khám, câu hỏi thường gặp và các nội dung hỗ trợ đang có trên website."
      >
        <PublicFilterPanel className="max-w-4xl">
          <label className="relative block">
            <span className="sr-only">Từ khóa tìm kiếm</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Ví dụ: tim mạch, bác sĩ, gói tổng quát, thanh toán..."
              className="ui-field h-14 w-full pl-12 pr-4 text-base placeholder:text-[#93a2b7]"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2" aria-label="Loại nội dung tìm kiếm">
            {searchTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setType(tab.value)}
                aria-pressed={type === tab.value}
                className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  type === tab.value
                    ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white shadow-sm"
                    : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </PublicFilterPanel>
      </PublicPageHero>

      <PublicCatalogSection
        status={resultLabel}
        error={searchQuery.error instanceof Error ? searchQuery.error.message : undefined}
        hasActiveFilters={Boolean(keyword || type !== "all")}
        onResetFilters={() => { setKeyword(""); setType("all"); }}
      >
        {searchQuery.isFetching && !items.length && shouldSearch ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <ResultSkeleton key={index} />
            ))}
          </div>
        ) : items.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <SearchResultCard key={`${item.type}-${item.id}`} item={item} query={trimmedKeyword} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--public-border)] bg-white p-8 text-center">
            <Search className="mx-auto h-10 w-10 text-[#93a2b7]" />
            <h2 className="mt-3 text-lg font-semibold">{shouldSearch ? "Không có kết quả phù hợp" : "Bạn muốn tìm thông tin nào?"}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--public-muted)]">
              {shouldSearch
                ? "Thử đổi từ khóa ngắn hơn hoặc chọn bộ lọc Tất cả để mở rộng phạm vi tìm kiếm."
                : "Nhập tên chuyên khoa, bác sĩ, gói khám hoặc câu hỏi để hệ thống gợi ý nội dung liên quan."}
            </p>
          </div>
        )}
      </PublicCatalogSection>
    </main>
  );
}

function SearchResultCard({ item, query }: { item: PublicSearchItem; query: string }) {
  return (
    <Link href={item.url} className="group block rounded-2xl border border-[var(--public-border)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-[var(--public-shadow-soft)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
          {typeIcons[item.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[var(--public-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--public-primary-dark)]">{typeLabels[item.type]}</span>
            {item.departmentName ? (
              <span className="text-xs text-[var(--public-muted)]">
                <HighlightText text={item.departmentName} query={query} />
              </span>
            ) : null}
            {item.price ? <span className="text-xs font-semibold text-[var(--public-primary-dark)]">{formatCurrency(item.price)}</span> : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--public-ink)] group-hover:text-[var(--public-primary)]">
            <HighlightText text={item.title} query={query} />
          </h2>
          {item.description ? (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">
              <HighlightText text={item.description} query={query} />
            </p>
          ) : null}
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--public-primary)]">
            Xem chi tiết
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ResultSkeleton() {
  return (
    <article className="rounded-2xl border border-[var(--public-border)] bg-white p-4">
      <div className="flex gap-3">
        <span className="skeleton-shimmer block h-10 w-10 shrink-0 rounded-md" />
        <div className="flex-1 space-y-3">
          <span className="skeleton-shimmer block h-4 w-24 rounded-md" />
          <span className="skeleton-shimmer block h-6 w-2/3 rounded-md" />
          <span className="skeleton-shimmer block h-4 w-full rounded-md" />
          <span className="skeleton-shimmer block h-4 w-5/6 rounded-md" />
        </div>
      </div>
    </article>
  );
}

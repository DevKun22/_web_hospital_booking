"use client";

import { ArrowRight, HelpCircle, Search, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { HighlightText } from "@/components/public/search-highlight";
import { PublicPageHeader } from "@/components/public/public-page-layout";
import { usePublicSearch, type PublicSearchItem, type PublicSearchType } from "@/lib/public-search-query";
import { useSearchAnalytics } from "@/lib/use-search-analytics";
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
  chatbot_faq: "Trợ lý",
};

const typeIcons: Record<PublicSearchItem["type"], ReactNode> = {
  department: <Stethoscope className="h-4 w-4" />,
  doctor: <UserRound className="h-4 w-4" />,
  package: <Search className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
  chatbot_faq: <HelpCircle className="h-4 w-4" />,
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
  useSearchAnalytics({
    keyword: trimmedKeyword,
    type,
    data: searchQuery.data,
    enabled: shouldSearch && !searchQuery.isFetching,
  });

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
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <PublicPageHeader />

      <section className="border-b border-[#dce3ee] bg-[linear-gradient(120deg,#ffffff_0%,#eef7ff_58%,#f4fbf6_100%)]">
        <div className="ui-container py-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">Tìm kiếm</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Tìm nhanh thông tin trước khi đặt lịch</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667892]">
            Tìm chuyên khoa, bác sĩ, gói khám, câu hỏi thường gặp và các nội dung hỗ trợ đang có trên website.
          </p>

          <label className="relative mt-6 block max-w-3xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667892]" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Ví dụ: tim mạch, bác sĩ, gói tổng quát, thanh toán..."
              className="ui-field h-14 w-full pl-12 pr-4 text-base shadow-sm placeholder:text-[#93a2b7]"
              autoFocus
            />
          </label>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {searchTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setType(tab.value)}
                className={`shrink-0 rounded-md border px-4 py-2 text-sm font-semibold transition ${
                  type === tab.value
                    ? "border-[#0d4f8b] bg-[#0d4f8b] text-white shadow-sm shadow-[#0d4f8b]/20"
                    : "border-[#cfd8e6] bg-white text-[#42526b] hover:border-[#0d4f8b] hover:text-[#0d4f8b]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="ui-container py-10 sm:py-12">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-[#667892]">{resultLabel}</p>
          {searchQuery.data?.source && searchQuery.data.source !== "empty" ? (
            <span className="w-fit rounded-full border border-[#d8e9ff] bg-white px-3 py-1 text-xs font-semibold text-[#0d4f8b]">
              Nguồn: {searchQuery.data.source === "elasticsearch" ? "Elasticsearch" : "PostgreSQL dự phòng"}
            </span>
          ) : null}
        </div>

        {searchQuery.error instanceof Error ? (
          <div className="mb-4 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-4 py-3 text-sm text-[#b3261e]">
            {searchQuery.error.message}
          </div>
        ) : null}

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
          <div className="rounded-md border border-dashed border-[#dce3ee] bg-white p-8 text-center">
            <Search className="mx-auto h-10 w-10 text-[#93a2b7]" />
            <h2 className="mt-3 text-lg font-semibold">{shouldSearch ? "Không có kết quả phù hợp" : "Bạn muốn tìm thông tin nào?"}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#667892]">
              {shouldSearch
                ? "Thử đổi từ khóa ngắn hơn hoặc chọn bộ lọc Tất cả để mở rộng phạm vi tìm kiếm."
                : "Nhập tên chuyên khoa, bác sĩ, gói khám hoặc câu hỏi để hệ thống gợi ý nội dung liên quan."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function SearchResultCard({ item, query }: { item: PublicSearchItem; query: string }) {
  return (
    <Link href={item.url} className="group block rounded-md border border-[#dce3ee] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#b7c9df] hover:shadow-lg">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e7f0fb] text-[#0d4f8b]">
          {typeIcons[item.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#eef7ff] px-2 py-0.5 text-xs font-semibold text-[#0d4f8b]">{typeLabels[item.type]}</span>
            {item.departmentName ? (
              <span className="text-xs text-[#667892]">
                <HighlightText text={item.departmentName} query={query} />
              </span>
            ) : null}
            {item.price ? <span className="text-xs font-semibold text-[#0d4f8b]">{formatCurrency(item.price)}</span> : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[#172033] group-hover:text-[#0d4f8b]">
            <HighlightText text={item.title} query={query} />
          </h2>
          {item.description ? (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#667892]">
              <HighlightText text={item.description} query={query} />
            </p>
          ) : null}
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0d4f8b]">
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
    <article className="rounded-md border border-[#dce3ee] bg-white p-4">
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

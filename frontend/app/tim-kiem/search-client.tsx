"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CatalogHeader, FilterChip, RowList, RowSkeleton } from "@/components/public/catalog-parts";
import { HighlightText } from "@/components/public/search-highlight";
import { formatOptionalCurrency } from "@/lib/format";
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

  const status = !shouldSearch
    ? "Nhập ít nhất 2 ký tự để tìm."
    : searchQuery.isFetching
      ? "Đang tìm..."
      : items.length
        ? `${items.length} kết quả`
        : "Chưa có kết quả phù hợp.";

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <CatalogHeader current="Tìm kiếm" title="Tìm kiếm" description="Chuyên khoa, bác sĩ, gói khám và câu hỏi thường gặp.">
        <div role="search" className="flex min-h-12 max-w-xl items-center gap-2 rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3 focus-within:border-[var(--public-primary)]">
          <Search className="h-5 w-5 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
          <label htmlFor="site-search" className="sr-only">Từ khóa tìm kiếm</label>
          <input
            id="site-search"
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Ví dụ: tim mạch, tổng quát, thanh toán"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base"
            style={{ outline: "none", boxShadow: "none" }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Loại nội dung">
          {searchTabs.map((tab) => (
            <FilterChip key={tab.value} selected={type === tab.value} onClick={() => setType(tab.value)}>{tab.label}</FilterChip>
          ))}
        </div>
      </CatalogHeader>

      <section className="ui-container py-6 sm:py-8">
        <p className="text-sm text-[var(--public-muted)]" aria-live="polite">{status}</p>
        {searchQuery.error instanceof Error ? <p role="alert" className="mt-2 text-sm text-[var(--public-danger)]">{searchQuery.error.message}</p> : null}
        <div className="mt-3">
          {searchQuery.isFetching && !items.length && shouldSearch ? (
            <RowSkeleton rows={4} />
          ) : items.length ? (
            <RowList busy={searchQuery.isFetching}>
              {items.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <Link href={item.url} className="block p-4 hover:bg-[var(--public-surface-muted)]">
                    <p className="text-sm text-[var(--public-muted)]">
                      {typeLabels[item.type]}
                      {item.departmentName ? <> · <HighlightText text={item.departmentName} query={trimmedKeyword} /></> : null}
                      {item.price ? <> · <span className="font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatOptionalCurrency(item.price)}</span></> : null}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold"><HighlightText text={item.title} query={trimmedKeyword} /></h2>
                    {item.description ? <p className="mt-1 line-clamp-2 text-base text-[var(--public-text-soft)]"><HighlightText text={item.description} query={trimmedKeyword} /></p> : null}
                  </Link>
                </li>
              ))}
            </RowList>
          ) : shouldSearch ? (
            <p className="rounded-lg border border-dashed border-[var(--public-border)] p-6 text-center text-sm text-[var(--public-muted)]">Thử từ khóa ngắn hơn hoặc chọn &quot;Tất cả&quot; để mở rộng phạm vi.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

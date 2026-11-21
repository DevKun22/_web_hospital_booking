"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CatalogHeader, ChipRow, FilterChip, RowList, RowSkeleton } from "@/components/public/catalog-parts";
import { FLAT_SEARCH_BUTTON_CLASS, FLAT_SEARCH_INPUT_CLASS } from "@/components/public/chip-styles";
import { HighlightText } from "@/components/public/search-highlight";
import { formatOptionalCurrency } from "@/lib/format";
import { usePublicDepartments } from "@/lib/public-lists-query";
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
  const departmentsQuery = usePublicDepartments();
  // Chưa nhập từ khóa: gợi ý bằng các chuyên khoa thật đang có, không bịa từ khóa.
  const suggestions = (departmentsQuery.data || []).filter((item) => item.slug).slice(0, 8);

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
        <div className="space-y-3">
          <form role="search" onSubmit={(event) => event.preventDefault()} className="max-w-xl">
            <label className="relative block">
              <span className="sr-only">Từ khóa tìm kiếm</span>
              <input
                id="site-search"
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm chuyên khoa, bác sĩ, gói khám hoặc câu hỏi"
                autoComplete="off"
                enterKeyHint="search"
                className={FLAT_SEARCH_INPUT_CLASS}
              />
              <button type="submit" aria-label="Tìm kiếm" className={FLAT_SEARCH_BUTTON_CLASS}>
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            </label>
          </form>
          <ChipRow label="Loại nội dung">
            {searchTabs.map((tab) => (
              <FilterChip key={tab.value} selected={type === tab.value} onClick={() => setType(tab.value)}>{tab.label}</FilterChip>
            ))}
          </ChipRow>
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
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--public-muted)]">
                      <span className="rounded-full bg-[var(--public-primary-soft)] px-2.5 py-0.5 text-sm font-medium text-[var(--public-primary-dark)]">{typeLabels[item.type]}</span>
                      {item.departmentName ? <HighlightText text={item.departmentName} query={trimmedKeyword} /> : null}
                      {item.price ? <span className="font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatOptionalCurrency(item.price)}</span> : null}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold"><HighlightText text={item.title} query={trimmedKeyword} /></h2>
                    {item.description ? <p className="mt-1 line-clamp-2 text-base text-[var(--public-text-soft)]"><HighlightText text={item.description} query={trimmedKeyword} /></p> : null}
                  </Link>
                </li>
              ))}
            </RowList>
          ) : shouldSearch ? (
            <p className="rounded-lg border border-dashed border-[var(--public-border)] p-6 text-center text-sm text-[var(--public-muted)]">Thử từ khóa ngắn hơn hoặc chọn &quot;Tất cả&quot; để mở rộng phạm vi.</p>
          ) : suggestions.length ? (
            <div>
              <p className="text-sm font-medium text-[var(--public-ink)]">Xem nhanh chuyên khoa</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <li key={item.id}><Link href={`/chuyen-khoa/${item.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-[var(--public-border)] bg-[var(--public-surface)] px-3.5 text-sm font-medium text-[var(--public-text-soft)] hover:border-[var(--public-primary)]">{item.name}</Link></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

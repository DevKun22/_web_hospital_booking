"use client";

import { CircleHelp, Package, Search, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CatalogHeader, CatalogStatusBar, ChipRow, FilterChip, RowList, RowSkeleton } from "@/components/public/catalog-parts";
import { FLAT_SEARCH_BUTTON_CLASS, FLAT_SEARCH_INPUT_CLASS } from "@/components/public/chip-styles";
import { HighlightText } from "@/components/public/search-highlight";
import { formatOptionalCurrency } from "@/lib/format";
import { usePublicDepartments } from "@/lib/public-lists-query";
import { usePublicSearch, type PublicSearchItem, type PublicSearchType } from "@/lib/public-search-query";
import { openPublicChatbot } from "@/lib/public-ui-events";
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

// Ô biểu tượng màu theo loại kết quả; nhóm hiện theo thứ tự này ở mục Tất cả.
// Loại kết quả phân biệt bằng biểu tượng; màu dùng chung một tông thương hiệu cho hài hòa.
const typeStyle: Record<PublicSearchItem["type"], { icon: LucideIcon }> = {
  department: { icon: Stethoscope },
  doctor: { icon: UserRound },
  package: { icon: Package },
  faq: { icon: CircleHelp },
};
const groupOrder: PublicSearchItem["type"][] = ["department", "doctor", "package", "faq"];

// Bốn lối vào khi chưa nhập từ khóa.
const entryLinks = [
  { href: "/chuyen-khoa", label: "Chuyên khoa", type: "department" as const },
  { href: "/bac-si", label: "Bác sĩ", type: "doctor" as const },
  { href: "/goi-kham", label: "Gói khám", type: "package" as const },
  { href: "/hoi-dap", label: "Hỏi đáp", type: "faq" as const },
];

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
  // Số kết quả mỗi loại cho các chip: lấy từ lượt tìm "Tất cả" (cùng khóa với lượt chính khi đang ở Tất cả nên không gọi thêm).
  const allQuery = usePublicSearch({ q: trimmedKeyword, type: "all", limit: 30 });
  const counts = (allQuery.data?.items || []).reduce<Record<string, number>>((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {});
  const countOf = (value: PublicSearchType) => (!shouldSearch || !allQuery.data ? null : value === "all" ? allQuery.data.items.length : counts[value] || 0);
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
      <CatalogHeader brand current="Tìm kiếm" title="Tìm kiếm" description="Chuyên khoa, bác sĩ, gói khám và câu hỏi thường gặp.">
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
            {searchTabs.map((tab) => {
              const count = countOf(tab.value);
              return <FilterChip key={tab.value} selected={type === tab.value} onClick={() => setType(tab.value)}>{tab.label}{count !== null ? ` (${count})` : ""}</FilterChip>;
            })}
          </ChipRow>
        </div>
      </CatalogHeader>

      <CatalogStatusBar
        status={status}
        chips={[
          ...(trimmedKeyword ? [{ key: "q", label: `“${trimmedKeyword}”`, onRemove: () => setKeyword("") }] : []),
          ...(type !== "all" ? [{ key: "type", label: searchTabs.find((tab) => tab.value === type)?.label || "", onRemove: () => setType("all") }] : []),
        ]}
        onReset={() => {
          setKeyword("");
          setType("all");
        }}
      />

      <section className="ui-container py-6 sm:py-8">
        {searchQuery.error instanceof Error ? <p role="alert" className="mb-3 text-sm text-[var(--public-danger)]">{searchQuery.error.message}</p> : null}
        <div>
          {searchQuery.isFetching && !items.length && shouldSearch ? (
            <RowSkeleton rows={4} />
          ) : items.length ? (
            type === "all" ? (
              <div className="space-y-5">
                {groupOrder.map((group) => {
                  const rows = items.filter((item) => item.type === group);
                  if (!rows.length) return null;
                  return (
                    <section key={group} aria-label={typeLabels[group]}>
                      <h2 className="mb-2 text-sm font-semibold text-[var(--public-ink)]">{typeLabels[group]} · {rows.length}</h2>
                      <RowList busy={searchQuery.isFetching}>{rows.map((item) => <ResultRow key={`${item.type}-${item.id}`} item={item} query={trimmedKeyword} />)}</RowList>
                    </section>
                  );
                })}
              </div>
            ) : (
              <RowList busy={searchQuery.isFetching}>{items.map((item) => <ResultRow key={`${item.type}-${item.id}`} item={item} query={trimmedKeyword} />)}</RowList>
            )
          ) : shouldSearch ? (
            <div className="rounded-lg border border-dashed border-[var(--public-border)] p-6 text-center text-sm text-[var(--public-muted)]">
              <p>Thử từ khóa ngắn hơn hoặc chọn &quot;Tất cả&quot; để mở rộng phạm vi.</p>
              <button type="button" onClick={() => openPublicChatbot()} className="mt-2 font-semibold text-[var(--public-primary)] underline underline-offset-4">Hỏi Kun để được gợi ý</button>
            </div>
          ) : (
            <div className="space-y-6">
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {entryLinks.map((entry, index) => {
                  const { icon: Icon } = typeStyle[entry.type];
                  return (
                    <li key={entry.href} style={{ "--i": index } as React.CSSProperties} className="catalog-rise">
                      <Link href={entry.href} className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 text-center text-sm font-semibold transition hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                        {entry.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {suggestions.length ? (
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
          )}
        </div>
      </section>
    </main>
  );
}

// Một dòng kết quả: ô biểu tượng màu theo loại, tên và mô tả có tô nổi từ khóa, giá (gói khám) bên phải.
function ResultRow({ item, query }: { item: PublicSearchItem; query: string }) {
  const { icon: Icon } = typeStyle[item.type];
  return (
    <li>
      <Link href={item.url} className="flex items-start gap-3 p-4 hover:bg-[var(--public-surface-muted)]">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]" aria-hidden="true"><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--public-muted)]">
            <span className="font-medium text-[var(--public-primary-dark)]">{typeLabels[item.type]}</span>
            {item.departmentName ? <HighlightText text={item.departmentName} query={query} /> : null}
          </span>
          <span className="mt-0.5 block text-lg font-semibold"><HighlightText text={item.title} query={query} /></span>
          {item.description ? <span className="mt-1 line-clamp-2 block text-base text-[var(--public-text-soft)]"><HighlightText text={item.description} query={query} /></span> : null}
        </span>
        {item.price ? <span className="shrink-0 text-base font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatOptionalCurrency(item.price)}</span> : null}
      </Link>
    </li>
  );
}

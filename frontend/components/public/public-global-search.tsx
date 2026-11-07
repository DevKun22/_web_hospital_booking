"use client";

import {
  Building2,
  ChevronRight,
  CircleHelp,
  Loader2,
  PackageCheck,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { HighlightText } from "@/components/public/search-highlight";
import {
  usePublicSearch,
  type PublicSearchItem,
} from "@/lib/public-search-query";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const typeMeta: Record<PublicSearchItem["type"], { label: string; icon: LucideIcon }> = {
  department: { label: "Chuyên khoa", icon: Building2 },
  doctor: { label: "Bác sĩ", icon: Stethoscope },
  package: { label: "Gói khám", icon: PackageCheck },
  faq: { label: "Hỏi đáp", icon: CircleHelp },
};

const formatCurrency = (value?: number | null) =>
  value
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value)
    : "";

export function PublicGlobalSearch({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedKeyword = useDebouncedValue(keyword, 220);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const searchQuery = usePublicSearch({
    q: debouncedKeyword.trim(),
    type: "all",
    limit: 12,
  });
  const items = searchQuery.isPlaceholderData ? [] : searchQuery.data?.items || [];
  const shouldShowDropdown = open && keyword.trim().length >= 2;
  const waitingDebounce = keyword.trim() !== debouncedKeyword.trim();
  const highlightQuery = debouncedKeyword.trim() || keyword.trim();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  const clearKeyword = () => {
    setKeyword("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const closeSearch = () => {
    setOpen(false);
    setKeyword("");
  };

  const searchInput = () => (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-primary)]" aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
        value={keyword}
        onChange={(event) => {
          setKeyword(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Nhập tên bác sĩ, chuyên khoa hoặc gói khám..."
        autoComplete="off"
        enterKeyHint="search"
        role="searchbox"
        className="h-11 w-full rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] pl-10 pr-11 text-sm text-[var(--public-ink)] outline-none transition placeholder:text-[var(--public-muted)] focus:border-[var(--public-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--public-primary-soft)]"
      />
      {keyword ? (
        <button
          type="button"
          onClick={clearKeyword}
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--public-muted)] transition hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-primary)]"
          aria-label="Xóa từ khóa tìm kiếm"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  const searchResults = () => {
    if (keyword.trim().length < 2) {
      return null;
    }

    return (
      <div id={`${inputId}-results`} className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[75] overflow-hidden rounded-2xl border border-[var(--public-border)] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--public-divider)] bg-[var(--public-surface-muted)] px-4 py-2.5 text-xs font-medium text-[var(--public-muted)] sm:px-5">
          {waitingDebounce || searchQuery.isFetching ? (
            <span className="inline-flex items-center gap-2" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Đang tìm kiếm...
            </span>
          ) : items.length ? (
            <span aria-live="polite">{items.length} kết quả phù hợp</span>
          ) : (
            <span aria-live="polite">Không tìm thấy kết quả phù hợp</span>
          )}
          <span className="hidden sm:inline">Nguồn dữ liệu hệ thống</span>
        </div>

        {searchQuery.isError ? (
          <div className="px-5 py-8 text-center">
            <p className="font-bold text-[var(--public-ink)]">Chưa thể tải kết quả</p>
            <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">Vui lòng kiểm tra kết nối và thử lại.</p>
            <button type="button" onClick={() => void searchQuery.refetch()} className="public-button-secondary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold">
              Thử lại
            </button>
          </div>
        ) : null}

        {!searchQuery.isError && !waitingDebounce && !searchQuery.isFetching && items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Search className="mx-auto h-8 w-8 text-[var(--public-primary)]" aria-hidden="true" />
            <p className="mt-3 font-bold text-[var(--public-ink)]">Chưa có kết quả cho “{debouncedKeyword.trim()}”</p>
            <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">Thử tên ngắn hơn, bỏ học hàm/học vị hoặc dùng từ khóa tổng quát hơn.</p>
          </div>
        ) : null}

        {!searchQuery.isError ? (
          <div className="max-h-[min(420px,58vh)] overflow-y-auto p-2 sm:p-3">
            {items.map((item) => {
              const meta = typeMeta[item.type];
              const ItemIcon = meta.icon;
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.url}
                  onClick={closeSearch}
                  className="group flex min-h-[5.5rem] items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[var(--public-surface-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--public-primary-soft)] sm:px-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)] transition group-hover:bg-white">
                    <ItemIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--public-primary)]">{meta.label}</span>
                      {item.departmentName ? (
                        <span className="text-xs text-[var(--public-muted)]"><HighlightText text={item.departmentName} query={highlightQuery} /></span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm font-bold leading-5 text-[var(--public-ink)] sm:text-base">
                      <HighlightText text={item.title} query={highlightQuery} />
                    </span>
                    {item.description ? (
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--public-muted)] sm:text-sm">
                        <HighlightText text={item.description} query={highlightQuery} />
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    {item.price ? <span className="text-xs font-bold tabular-nums text-[var(--public-primary-dark)] sm:text-sm">{formatCurrency(item.price)}</span> : null}
                    <ChevronRight className="h-4 w-4 text-[var(--public-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--public-primary)] motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}

        {!searchQuery.isError && !waitingDebounce && !searchQuery.isFetching && items.length ? (
          <Link
            href={`/tim-kiem?q=${encodeURIComponent(debouncedKeyword.trim())}`}
            onClick={closeSearch}
            className="flex min-h-12 items-center justify-center gap-2 border-t border-[var(--public-divider)] bg-[var(--public-primary-soft)] px-4 py-3 text-center text-sm font-bold text-[var(--public-primary-dark)] transition hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--public-primary)]"
          >
            Xem toàn bộ kết quả
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative ${compact ? "w-full" : "w-[280px] xl:w-[340px]"}`}
    >
      <label className="sr-only" htmlFor={inputId}>
        Tìm kiếm trên website
      </label>
      {searchInput()}
      {shouldShowDropdown ? searchResults() : null}
    </div>
  );
}

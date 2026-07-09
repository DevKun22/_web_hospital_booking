"use client";

import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HighlightText } from "@/components/public/search-highlight";
import {
  usePublicSearch,
  type PublicSearchItem,
} from "@/lib/public-search-query";
import { useSearchAnalytics } from "@/lib/use-search-analytics";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const typeLabels: Record<PublicSearchItem["type"], string> = {
  department: "Chuyên khoa",
  doctor: "Bác sĩ",
  package: "Gói khám",
  faq: "FAQ",
  chatbot_faq: "Trợ lý",
};

const formatCurrency = (value?: number | null) =>
  value
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value)
    : "";

export function PublicGlobalSearch({ compact = false }: { compact?: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedKeyword = useDebouncedValue(keyword, 220);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchQuery = usePublicSearch({
    q: debouncedKeyword.trim(),
    type: "all",
    limit: 8,
  });
  const items = searchQuery.data?.items || [];
  const shouldShowDropdown = open && keyword.trim().length >= 2;
  const waitingDebounce = keyword.trim() !== debouncedKeyword.trim();
  const highlightQuery = debouncedKeyword.trim() || keyword.trim();
  useSearchAnalytics({
    keyword: debouncedKeyword,
    type: "all",
    data: searchQuery.data,
    enabled: !waitingDebounce && !searchQuery.isFetching,
  });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const clearKeyword = () => {
    setKeyword("");
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative ${compact ? "w-full" : "w-[280px] xl:w-[340px]"}`}
    >
      <label
        className="sr-only"
        htmlFor={compact ? "mobile-public-search" : "public-search"}
      >
        Tìm kiếm trên website
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667892]" />
        <input
          id={compact ? "mobile-public-search" : "public-search"}
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm bác sĩ, khoa, gói khám..."
          className="h-10 w-full rounded-md border border-[#cfd8e6] bg-white pl-9 pr-9 text-sm text-[#172033] outline-none transition placeholder:text-[#93a2b7] focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"
        />
        {keyword ? (
          <button
            type="button"
            onClick={clearKeyword}
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#667892] hover:bg-[#f1f5f9]"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {shouldShowDropdown ? (
        <div className="absolute left-0 right-0 top-12 z-[75] overflow-hidden rounded-md border border-[#dce3ee] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
          <div className="border-b border-[#eef2f7] px-3 py-2 text-xs font-medium text-[#667892]">
            {waitingDebounce || searchQuery.isFetching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang tìm kiếm...
              </span>
            ) : searchQuery.data?.source === "elasticsearch" ? (
              "Kết quả từ Elasticsearch"
            ) : searchQuery.data?.source === "postgres" ? (
              "Kết quả dự phòng từ PostgreSQL"
            ) : (
              "Nhập ít nhất 2 ký tự để tìm kiếm"
            )}
          </div>

          {!waitingDebounce && !searchQuery.isFetching && items.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm text-[#667892]">
              Không tìm thấy kết quả phù hợp.
            </div>
          ) : null}

          <div className="max-h-[min(360px,58vh)] overflow-y-auto py-1">
            {items.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.url}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 transition hover:bg-[#f8fafc]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#e7f0fb] px-2 py-0.5 text-[11px] font-semibold text-[#0d4f8b]">
                        {typeLabels[item.type]}
                      </span>
                      {item.departmentName ? (
                        <span className="text-[11px] text-[#667892]">
                          <HighlightText
                            text={item.departmentName}
                            query={highlightQuery}
                          />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-[#172033]">
                      <HighlightText text={item.title} query={highlightQuery} />
                    </p>
                    {item.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667892]">
                        <HighlightText
                          text={item.description}
                          query={highlightQuery}
                        />
                      </p>
                    ) : null}
                  </div>
                  {item.price ? (
                    <span className="shrink-0 text-xs font-semibold text-[#0d4f8b]">
                      {formatCurrency(item.price)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>

          {!waitingDebounce && !searchQuery.isFetching && items.length ? (
            <Link
              href={`/search?q=${encodeURIComponent(debouncedKeyword.trim())}`}
              onClick={() => setOpen(false)}
              className="block border-t border-[#eef2f7] bg-[#f8fbff] px-3 py-2.5 text-center text-sm font-semibold text-[#0d4f8b] transition hover:bg-[#eef7ff]"
            >
              Xem tất cả kết quả tìm kiếm
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

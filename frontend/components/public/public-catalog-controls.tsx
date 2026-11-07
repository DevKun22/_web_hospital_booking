"use client";

import { ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { PublicFilterPanel } from "@/components/public/public-page-layout";

export function PublicCatalogSearch({
  value,
  onChange,
  onSubmit,
  placeholder,
  children,
  onReset,
  canReset,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  children?: ReactNode;
  onReset: () => void;
  canReset: boolean;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <PublicFilterPanel className="space-y-3">
      <form onSubmit={submit} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Từ khóa tìm kiếm</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            className="ui-field min-h-11 w-full pl-10 pr-3 text-base sm:text-sm"
          />
        </label>
        <button type="submit" className="public-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">
          <Search className="h-4 w-4" aria-hidden="true" />
          Tìm kiếm
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          className="public-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Đặt lại
        </button>
      </form>
      {children}
    </PublicFilterPanel>
  );
}

export function PublicPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1,
  );

  return (
    <nav aria-label="Phân trang" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <PageButton label="Trang trước" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </PageButton>
      {pages.map((item, index) => {
        const previous = pages[index - 1];
        return (
          <span key={item} className="contents">
            {previous && item - previous > 1 ? <span className="px-1 text-[var(--public-muted)]">…</span> : null}
            <button
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={`min-h-10 min-w-10 rounded-lg border px-3 text-sm font-semibold transition ${
                item === page
                  ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
                  : "border-[var(--public-border)] bg-white text-[var(--public-ink)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
              }`}
            >
              {item}
            </button>
          </span>
        );
      })}
      <PageButton label="Trang sau" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PageButton>
    </nav>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--public-border)] bg-white text-[var(--public-ink)] transition hover:border-[var(--public-primary)] hover:text-[var(--public-primary)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

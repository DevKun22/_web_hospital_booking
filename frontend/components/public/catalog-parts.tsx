"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { openPublicChatbot } from "@/lib/public-ui-events";

// Đầu trang danh mục: đường dẫn, tiêu đề, một câu mô tả; không có ảnh nền, ô số liệu hay nhãn trang trí.
export function CatalogHeader({ current, title, description, children }: { current: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <header className="border-b border-[var(--public-border)] bg-[var(--public-surface)]">
      <div className="ui-container py-5 sm:py-7">
        <nav aria-label="Đường dẫn trang" className="mb-3 flex items-center gap-1.5 text-sm text-[var(--public-muted)]">
          <Link href="/" className="hover:text-[var(--public-primary)]">Trang chủ</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-semibold text-[var(--public-ink)]" aria-current="page">{current}</span>
        </nav>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--public-text-soft)]">{description}</p> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </header>
  );
}

// Chip lọc nhanh: bo tròn, chip đang chọn tô nhạt; dùng chung cho các trang danh mục, hỏi đáp và tìm kiếm.
export function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)] ${
        selected
          ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"
          : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-text-soft)] hover:border-[var(--public-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

// Hàng chip: điện thoại cuộn ngang một dòng, màn hình rộng xuống dòng khi dài.
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {children}
    </div>
  );
}

// Ô chọn gọn trên thanh lọc: không nhãn hiện, tên ô nằm ở aria-label và lựa chọn đầu tiên.
export function FlatSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="ui-field min-h-11 w-full rounded-full px-4 text-base sm:w-auto sm:min-w-[11rem] sm:text-sm"
    >
      {children}
    </select>
  );
}

// Danh sách hàng viền mảnh dùng chung cho chuyên khoa, gói khám.
export function RowList({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <ul aria-busy={busy} className={`divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] ${busy ? "opacity-70" : ""}`}>
      {children}
    </ul>
  );
}

export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <RowList>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="space-y-2 p-4">
          <span className="skeleton-shimmer block h-5 w-1/2 rounded" />
          <span className="skeleton-shimmer block h-4 w-4/5 rounded" />
          <span className="skeleton-shimmer block h-4 w-1/3 rounded" />
        </li>
      ))}
    </RowList>
  );
}

// Một dòng gợi ý cuối trang thay cho khối kêu gọi lớn.
export function ChatbotHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 text-sm text-[var(--public-muted)]">
      {children}{" "}
      <button type="button" onClick={() => openPublicChatbot()} className="font-semibold text-[var(--public-primary)] underline underline-offset-4">
        Hỏi trợ lý
      </button>
    </p>
  );
}

export function ResultCount({ loading, shown, total, noun }: { loading: boolean; shown: number; total: number; noun: string }) {
  return (
    <p className="text-sm text-[var(--public-muted)]" aria-live="polite">
      {loading ? `Đang tải ${noun}...` : `${shown} trên ${total} ${noun}`}
    </p>
  );
}

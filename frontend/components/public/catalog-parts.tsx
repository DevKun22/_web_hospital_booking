"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { WaveEdge } from "@/components/public/wave-edge";
import { chipClass } from "@/components/public/chip-styles";
import { openPublicChatbot } from "@/lib/public-ui-events";

// Đầu trang danh mục: đường dẫn, tiêu đề, một câu mô tả. Biến thể "brand" (các danh mục dịch vụ) là dải xanh thấp cùng ngôn ngữ với trang chủ, sóng nhẹ ở đáy; biến thể mặc định
// là nền trắng trơn. Không có ảnh nền, ô số liệu hay nhãn trang trí.
export function CatalogHeader({ current, title, description, children, brand = false, trail = [], overlap = false }: { current: string; title: string; description?: string; children?: ReactNode; brand?: boolean; trail?: { label: string; href: string }[]; overlap?: boolean }) {
  if (brand) {
    return (
      <header className="relative bg-[linear-gradient(120deg,var(--hero-from)_0%,var(--hero-via)_58%,var(--hero-to)_100%)] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <WaveEdge />
        </div>
        <div className={`ui-container relative z-10 pt-5 sm:pt-7 ${overlap ? "pb-9 sm:pb-11 lg:pb-28" : "pb-9 sm:pb-11"}`}>
          <nav aria-label="Đường dẫn trang" className="mb-3 flex items-center gap-1.5 text-sm text-white/80">
            <Link href="/" className="hover:text-white hover:underline">Trang chủ</Link>
            {trail.map((crumb) => (
              <span key={crumb.href} className="contents">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <Link href={crumb.href} className="hover:text-white hover:underline">{crumb.label}</Link>
              </span>
            ))}
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-semibold text-white" aria-current="page">{current}</span>
          </nav>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-base leading-7 text-white/90">{description}</p> : null}
          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      </header>
    );
  }
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

// Thanh kết quả dính dưới header khi cuộn: số kết quả, các lọc đang bật (mỗi chip bấm × để bỏ) và "Xóa lọc". Đổi lọc không cần cuộn lên đầu trang.
export function CatalogStatusBar({ status, chips, onReset, extra }: { status: string; chips: { key: string; label: string; onRemove: () => void }[]; onReset: () => void; extra?: ReactNode }) {
  return (
    <div className="sticky top-[7.6rem] z-30 border-b border-[var(--public-border)] bg-[var(--public-surface)]/95 backdrop-blur xl:top-[4.25rem]">
      <div className="ui-container flex min-h-12 flex-wrap items-center gap-2 py-2">
        <p className="mr-1 text-sm font-semibold text-[var(--public-ink)]" aria-live="polite">{status}</p>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            aria-label={`Bỏ lọc ${chip.label}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--public-primary)] bg-[var(--public-primary-soft)] px-3 text-sm font-medium text-[var(--public-primary-dark)] transition hover:bg-[var(--public-tint-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)]"
          >
            {chip.label}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3">
          {extra}
          {chips.length ? (
            <button type="button" onClick={onReset} className="inline-flex min-h-8 items-center text-sm font-medium text-[var(--public-primary)] underline underline-offset-4">
              Xóa lọc
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// Thanh kết quả dính cho trang máy chủ (danh sách bài viết): số kết quả, chip lọc đang bật là liên kết bỏ lọc và liên kết Xóa lọc.
export function CatalogStatusLinks({ status, chips, resetHref }: { status: string; chips: { key: string; label: string; href: string }[]; resetHref: string }) {
  return (
    <div className="sticky top-[7.6rem] z-30 border-b border-[var(--public-border)] bg-[var(--public-surface)]/95 backdrop-blur xl:top-[4.25rem]">
      <div className="ui-container flex min-h-12 flex-wrap items-center gap-2 py-2">
        <p className="mr-1 text-sm font-semibold text-[var(--public-ink)]" aria-live="polite">{status}</p>
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            aria-label={`Bỏ lọc ${chip.label}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--public-primary)] bg-[var(--public-primary-soft)] px-3 text-sm font-medium text-[var(--public-primary-dark)] transition hover:bg-[var(--public-tint-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)]"
          >
            {chip.label}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
        {chips.length ? <Link href={resetHref} className="ml-auto inline-flex min-h-8 items-center text-sm font-medium text-[var(--public-primary)] underline underline-offset-4">Xóa lọc</Link> : null}
      </div>
    </div>
  );
}

// Chip lọc nhanh: bo tròn, chip đang chọn tô nhạt; dùng chung cho các trang danh mục, hỏi đáp và tìm kiếm.
export function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={chipClass(selected)}
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

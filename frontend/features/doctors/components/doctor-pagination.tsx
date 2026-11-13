import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageNumbers } from "@/features/doctors/filters";

type PaginationInfo = { page: number; totalPages: number };

export function DoctorPagination({ pagination, onChange }: { pagination: PaginationInfo; onChange: (page: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--public-divider)] pt-5" aria-label="Phân trang danh sách bác sĩ">
      <p className="text-sm text-[var(--public-muted)]">Trang {page} / {totalPages}</p>
      <div className="flex items-center gap-1.5">
        <PageButton label="Trang trước" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </PageButton>
        {buildPageNumbers(page, totalPages).map((pageNumber) => (
          <PageButton key={pageNumber} label={`Trang ${pageNumber}`} active={pageNumber === page} onClick={() => onChange(pageNumber)}>
            {pageNumber}
          </PageButton>
        ))}
        <PageButton label="Trang sau" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
          : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

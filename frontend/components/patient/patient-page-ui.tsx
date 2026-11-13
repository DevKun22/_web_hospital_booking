import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export function PatientPageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

// Khung chờ theo hình dạng nội dung sắp hiện, tránh màn hình trắng và giật bố cục.
export function PatientPageLoading({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
          <span className="skeleton-shimmer block h-4 w-1/3 rounded" />
          <span className="skeleton-shimmer mt-3 block h-5 w-2/3 rounded" />
          <span className="skeleton-shimmer mt-2 block h-4 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function PatientPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-[var(--public-danger)] bg-[var(--public-surface)] p-5">
      <p className="flex items-start gap-2 text-sm font-semibold text-[var(--public-danger)]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Chưa tải được dữ liệu
      </p>
      <p className="mt-1.5 text-sm text-[var(--public-text-soft)]">{message}</p>
      <button type="button" onClick={onRetry} className="public-button-secondary mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Thử lại
      </button>
    </div>
  );
}

// Lời mời hành động, không phải lời xin lỗi: nói đây là nơi nào, rồi đưa nút làm việc tiếp theo.
export function PatientEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--public-border)] p-6 text-center">
      <h2 className="font-bold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[var(--public-muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

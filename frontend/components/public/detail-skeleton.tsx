// Khung chờ dùng chung cho trang chi tiết: tiêu đề, vài dòng mô tả và cột bên phải.
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]" aria-busy="true" aria-label={label}>
      <div className="ui-container grid grid-cols-[minmax(0,1fr)] gap-6 py-5 sm:py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="space-y-3">
          <span className="skeleton-shimmer block h-4 w-40 rounded" />
          <span className="skeleton-shimmer block h-8 w-3/5 rounded" />
          <span className="skeleton-shimmer block h-5 w-2/5 rounded" />
          <span className="skeleton-shimmer block h-4 w-full max-w-2xl rounded" />
          <span className="skeleton-shimmer block h-4 w-5/6 max-w-2xl rounded" />
          <span className="skeleton-shimmer mt-6 block h-40 w-full rounded-lg" />
        </div>
        <span className="skeleton-shimmer block h-64 w-full rounded-xl" />
      </div>
    </main>
  );
}

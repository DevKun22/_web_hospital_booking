export function DoctorSkeleton() {
  return (
    <article className="public-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="skeleton-shimmer h-20 w-20 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-3">
          <span className="skeleton-shimmer block h-4 w-1/2 rounded" />
          <span className="skeleton-shimmer block h-5 w-5/6 rounded" />
          <span className="skeleton-shimmer block h-4 w-2/3 rounded" />
        </div>
      </div>
      <span className="skeleton-shimmer mt-4 block h-20 w-full rounded-xl" />
      <span className="skeleton-shimmer mt-3 block h-20 w-full rounded-xl" />
      <span className="skeleton-shimmer mt-4 block h-11 w-full rounded-xl" />
    </article>
  );
}

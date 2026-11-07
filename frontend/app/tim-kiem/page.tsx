import { Suspense } from "react";
import SearchClient from "./search-client";

export default function PublicSearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchClient />
    </Suspense>
  );
}

function SearchPageSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <div className="ui-container py-10 sm:py-14">
        <span className="skeleton-shimmer block h-6 w-32 rounded-md" />
        <span className="skeleton-shimmer mt-4 block h-11 w-full max-w-3xl rounded-md" />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="skeleton-shimmer block h-36 rounded-md" />
          ))}
        </div>
      </div>
    </main>
  );
}

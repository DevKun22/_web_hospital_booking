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
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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

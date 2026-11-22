"use client";

import { BookingFlow } from "@/features/booking/components/booking-flow";
import { usePublicBootstrap } from "@/lib/public-bootstrap-client";
import type { PublicBootstrapSnapshot } from "@/lib/public-bootstrap";

export function PublicBookingPageClient({ snapshot }: { snapshot: PublicBootstrapSnapshot }) {
  const { data, loading, error } = usePublicBootstrap("full", snapshot);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      {error ? (
        <div className="ui-container pt-5">
          <p className="rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]" role="alert">{error}</p>
        </div>
      ) : null}

      <BookingFlow catalog={data} loading={loading} hotline={data.settings?.hotline?.trim() || data.settings?.emergencyHotline?.trim() || ""} />
    </main>
  );
}

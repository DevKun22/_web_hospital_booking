"use client";

import { PublicHomeView } from "@/components/public/public-home-view";
import { usePublicBootstrap } from "@/lib/public-bootstrap-client";
import type { PublicBootstrapSnapshot } from "@/lib/public-bootstrap";

export function PublicHomeClient({ snapshot }: { snapshot: PublicBootstrapSnapshot }) {
  const { data, loading, error } = usePublicBootstrap("featured", snapshot);
  return <PublicHomeView data={data} loading={loading} error={error} />;
}

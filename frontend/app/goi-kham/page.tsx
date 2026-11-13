import { Suspense } from "react";
import { RowSkeleton } from "@/components/public/catalog-parts";
import { PackageCatalogClient } from "@/components/public/package-catalog-client";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";

const pageJsonLd = buildCollectionPageJsonLd({
  name: "Gói khám sức khỏe",
  description: "Danh sách gói khám, chi phí dự kiến, hạng mục đi kèm và đặt lịch khám trực tuyến.",
  path: "/goi-kham",
});

export default function PublicPackagesPage() {
  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }} />
      <Suspense fallback={<div className="ui-container min-h-[28rem] py-10"><RowSkeleton /></div>}>
        <PackageCatalogClient />
      </Suspense>
    </main>
  );
}

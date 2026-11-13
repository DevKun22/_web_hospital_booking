import { Suspense } from "react";
import { RowSkeleton } from "@/components/public/catalog-parts";
import { DepartmentCatalogClient } from "@/components/public/department-catalog-client";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";

const pageJsonLd = buildCollectionPageJsonLd({
  name: "Chuyên khoa",
  description: "Danh sách chuyên khoa, bác sĩ, gói khám và lịch khám đang tiếp nhận.",
  path: "/chuyen-khoa",
});

export default function PublicDepartmentsPage() {
  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }} />
      <Suspense fallback={<div className="ui-container min-h-[28rem] py-10"><RowSkeleton /></div>}>
        <DepartmentCatalogClient />
      </Suspense>
    </main>
  );
}

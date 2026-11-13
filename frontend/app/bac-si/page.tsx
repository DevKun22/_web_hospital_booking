import { Suspense } from "react";
import { DoctorCatalog } from "@/features/doctors/components/doctor-catalog";
import { DoctorSkeleton } from "@/features/doctors/components/doctor-skeleton";
import { buildCollectionPageJsonLd, jsonLdString } from "@/lib/seo";

const pageJsonLd = buildCollectionPageJsonLd({
  name: "Đội ngũ bác sĩ",
  description: "Danh sách bác sĩ, chuyên khoa, phí khám và lịch khám trống để đặt lịch trực tuyến.",
  path: "/bac-si",
});

// Khung trang dựng sẵn trên máy chủ; bộ lọc đọc từ địa chỉ trang nên danh mục nằm trong Suspense.
export default function PublicDoctorsPage() {
  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pageJsonLd) }} />
      <Suspense
        fallback={
          <div className="ui-container grid gap-5 py-10 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <DoctorSkeleton key={index} />
            ))}
          </div>
        }
      >
        <DoctorCatalog />
      </Suspense>
    </main>
  );
}

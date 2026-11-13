import { ShieldCheck } from "lucide-react";
import { PublicBreadcrumb } from "@/components/public/public-page-layout";
import { DoctorMetric } from "@/features/doctors/components/doctor-metric";

type DoctorHeroProps = {
  total?: number;
  departmentCount?: number;
  withTodaySlots?: number;
  reviewCount?: number;
};

const HIGHLIGHTS = ["Thông tin minh bạch", "Giờ trống theo hệ thống", "Xác thực lịch bằng OTP"];

export function DoctorHero({ total, departmentCount, withTodaySlots, reviewCount }: DoctorHeroProps) {
  return (
    <section className="border-b border-[var(--public-border)] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_62%,#f7fbff_100%)]">
      <div className="ui-container py-4 sm:py-6">
        <PublicBreadcrumb current="Đội ngũ bác sĩ" />
        <div className="grid gap-6 rounded-2xl border border-[var(--public-border)] bg-white/95 p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--public-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--public-primary-dark)]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Đội ngũ chuyên gia được công khai
            </p>
            <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] sm:text-3xl">Đội Ngũ Bác Sĩ &amp; Chuyên Gia Đầu Ngành</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)] sm:text-base">
              Khám phá đội ngũ bác sĩ đang tiếp nhận lịch trong hệ thống. Bạn có thể đối chiếu chuyên khoa, kinh nghiệm, đánh giá công khai, phí khám và khung giờ trước khi lựa chọn.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--public-text-soft)]">
              {HIGHLIGHTS.map((item) => (
                <span key={item} className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5">{item}</span>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <DoctorMetric label="Bác sĩ công khai" value={total} note="Theo bộ lọc hiện tại" />
            <DoctorMetric label="Chuyên khoa" value={departmentCount || undefined} note="Đang hoạt động" />
            <DoctorMetric label="Có lịch hôm nay" value={withTodaySlots} note="Khung giờ còn hiệu lực" positive />
            <DoctorMetric label="Đánh giá công khai" value={reviewCount} note="Đã qua kiểm duyệt" />
          </dl>
        </div>
      </div>
    </section>
  );
}

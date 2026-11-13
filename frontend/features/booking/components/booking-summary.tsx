import Link from "next/link";
import { Phone } from "lucide-react";
import { formatDayShort } from "@/features/booking/dates";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { doctorDisplayName } from "@/lib/doctor";
import { formatCurrency } from "@/lib/format";

const formatTime = (value: string) => value.slice(0, 5);

// Dữ liệu tóm tắt dùng chung cho phiếu bên phải (máy tính) và dòng tóm tắt ở thanh dưới (điện thoại).
export function useBookingSummaryData(flow: BookingFlow) {
  const { state, catalog, amount } = flow;
  const { selection, draft, slot } = state;
  const department = catalog.departments.find((item) => item.id === selection.departmentId);
  const doctor = catalog.doctors.find((item) => item.id === selection.doctorId);
  const pack = catalog.packages.find((item) => item.id === selection.packageId);
  const when = slot ? `${formatTime(slot.startTime)}, ${formatDayShort(slot.date.slice(0, 10))}` : draft.date ? formatDayShort(draft.date) : "";
  return { selection, department, doctor, pack, when, hasTime: Boolean(slot), amount };
}

// Dòng ngắn trên thanh hành động ở điện thoại: giờ đã chọn và giá, hoặc bác sĩ đang chọn.
export function MobileSummaryLine({ flow }: { flow: BookingFlow }) {
  const { doctor, when, hasTime, amount } = useBookingSummaryData(flow);
  if (!doctor && !hasTime) return null;
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-[var(--public-text-soft)]">{hasTime ? when : doctor ? doctorDisplayName(doctor) : ""}</span>
      {amount ? <strong className="shrink-0 tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(amount)}</strong> : null}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-[var(--public-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[var(--public-ink)]">{children}</dd>
    </div>
  );
}

export function BookingSummary({ flow, hotline }: { flow: BookingFlow; hotline: string }) {
  const { selection, department, doctor, pack, when, hasTime, amount } = useBookingSummaryData(flow);
  const { pending, verified } = flow.state;
  const status = verified ? "Đã xác thực" : pending ? "Chờ xác thực OTP" : "Đang chọn";
  const link = "underline underline-offset-2 hover:text-[var(--public-primary)]";
  const unset = <span className="text-[var(--public-muted)]">Chưa chọn</span>;

  return (
    <aside aria-label="Tóm tắt lịch hẹn" className="hidden space-y-4 lg:sticky lg:top-28 lg:block lg:self-start">
      <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
        <div className="flex items-baseline justify-between gap-3 border-b border-[var(--public-divider)] pb-3">
          <h2 className="text-base font-bold text-[var(--public-ink)]">Lịch hẹn của bạn</h2>
          <span className="text-xs font-semibold text-[var(--public-muted)]">{status}</span>
        </div>
        <dl className="divide-y divide-[var(--public-divider)]">
          <Row label="Chuyên khoa">
            {department ? <Link href={department.slug ? `/chuyen-khoa/${department.slug}` : "/chuyen-khoa"} className={link}>{department.name}</Link> : unset}
          </Row>
          <Row label="Bác sĩ">
            {doctor ? <Link href={`/bac-si/${encodeURIComponent(doctor.slug || doctor.id)}`} className={link}>{doctorDisplayName(doctor)}</Link> : unset}
          </Row>
          <Row label="Hình thức">
            {selection.serviceMode === "PACKAGE"
              ? pack
                ? <Link href={`/goi-kham/${pack.slug || pack.id}`} className={link}>{pack.name}</Link>
                : "Khám theo gói"
              : selection.serviceMode === "DOCTOR_ONLY"
                ? "Khám theo bác sĩ"
                : unset}
          </Row>
          <Row label="Thời gian">{hasTime ? when : unset}</Row>
        </dl>
        <div className="mt-1 flex items-baseline justify-between border-t border-[var(--public-border)] pt-3">
          <span className="text-sm text-[var(--public-muted)]">Tạm tính</span>
          <strong className="text-xl tabular-nums text-[var(--public-primary-dark)]">{amount ? formatCurrency(amount) : "—"}</strong>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--public-muted)]">Chi phí cuối cùng có thể thay đổi sau khi bệnh viện xác nhận.</p>
      </div>

      {hotline ? (
        <a href={`tel:${hotline}`} className="flex items-center gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 text-sm hover:border-[var(--public-primary)]">
          <Phone className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
          <span>
            <span className="block text-xs text-[var(--public-muted)]">Cần hỗ trợ đặt lịch</span>
            <strong className="tabular-nums text-[var(--public-ink)]">{hotline}</strong>
          </span>
        </a>
      ) : null}
    </aside>
  );
}

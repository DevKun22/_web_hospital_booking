import Link from "next/link";
import { CalendarDays, ClipboardCheck, Clock, Phone } from "lucide-react";
import { doctorDisplayName } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { formatCurrency } from "@/lib/format";
import { formatVietnamDate } from "@/lib/date";

const formatTime = (value: string) => value.slice(0, 5);

function SummaryRow({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <span className="text-xs font-medium text-[var(--public-muted)]">{label}</span>
      <span className="mt-1 block font-semibold text-[var(--public-ink)]">{value}</span>
      {hint ? <span className="mt-1 block text-xs leading-5 text-[var(--public-muted)]">{hint}</span> : null}
    </>
  );
  const box = "block rounded-md border border-[var(--public-border)] bg-white px-3 py-2";
  return href ? (
    <Link href={href} className={`${box} transition hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]`}>{body}</Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export function BookingSummary({ flow, hotline }: { flow: BookingFlow; hotline: string }) {
  const { state, catalog, amount } = flow;
  const { selection, draft, slot, pending, verified } = state;
  const department = catalog.departments.find((item) => item.id === selection.departmentId);
  const doctor = catalog.doctors.find((item) => item.id === selection.doctorId);
  const pack = catalog.packages.find((item) => item.id === selection.packageId);

  const badge = verified
    ? { text: "Đã xác thực", style: "bg-[var(--public-success-soft)] text-[var(--public-success)]" }
    : pending
      ? { text: "Chờ OTP", style: "bg-[var(--public-warning-soft)] text-[var(--public-warning)]" }
      : { text: "Đang lập phiếu", style: "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" };

  const packageValue =
    selection.serviceMode === "PACKAGE" ? pack?.name || "Chưa chọn gói khám" : selection.serviceMode === "DOCTOR_ONLY" ? "Khám theo bác sĩ" : "Chưa chọn hình thức khám";

  return (
    <aside aria-label="Tóm tắt lịch hẹn" className="space-y-4 lg:sticky lg:top-36 lg:self-start">
      <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--public-border)] bg-white p-4 shadow-[var(--public-shadow-soft)] sm:p-5">
        <span className="absolute inset-x-0 top-0 h-1.5 bg-[var(--public-primary)]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--public-divider)] pb-3 pt-1">
          <p className="flex items-center gap-2 font-bold text-[var(--public-ink)]">
            <ClipboardCheck className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" />
            Phiếu hẹn dự kiến
          </p>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${badge.style}`}>{badge.text}</span>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <SummaryRow
            label="Chuyên khoa"
            value={department?.name || "Chưa chọn chuyên khoa"}
            hint={department ? "Bấm để xem nhanh thông tin khoa" : "Chọn khoa để hệ thống lọc bác sĩ và gói khám"}
            href={department ? (department.slug ? `/chuyen-khoa/${department.slug}` : "/chuyen-khoa") : undefined}
          />
          <SummaryRow
            label="Bác sĩ"
            value={doctor ? doctorDisplayName(doctor) : "Chưa chọn bác sĩ"}
            hint={doctor ? "Bấm để xem nhanh hồ sơ bác sĩ" : "Chọn bác sĩ để xem lịch trống"}
            href={doctor ? `/bac-si/${encodeURIComponent(doctor.slug || doctor.id)}` : undefined}
          />
          <SummaryRow
            label="Gói khám"
            value={packageValue}
            hint={pack ? "Bấm để xem nhanh hạng mục và giá gói" : selection.serviceMode === "DOCTOR_ONLY" ? "Giá tạm tính theo phí khám của bác sĩ" : "Chọn khám theo bác sĩ hoặc một gói khám"}
            href={pack ? `/goi-kham/${pack.slug || pack.id}` : undefined}
          />
          <div className="rounded-md border border-[var(--public-border)] bg-white px-3 py-2">
            <span className="text-xs font-medium text-[var(--public-muted)]">Ngày khám</span>
            <p className="mt-1 flex items-center gap-2 font-semibold text-[var(--public-ink)]">
              <CalendarDays className="h-4 w-4 text-[var(--public-primary-dark)]" aria-hidden="true" />
              {slot ? formatVietnamDate(slot.date) : draft.date ? formatVietnamDate(draft.date) : "Chưa chọn ngày"}
            </p>
          </div>
          <div className="rounded-md border border-[var(--public-border)] bg-white px-3 py-2">
            <span className="text-xs font-medium text-[var(--public-muted)]">Giờ khám</span>
            <p className="mt-1 flex items-center gap-2 font-semibold text-[var(--public-ink)]">
              <Clock className="h-4 w-4 text-[var(--public-primary-dark)]" aria-hidden="true" />
              {slot ? `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}` : "Chưa chọn khung giờ"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-[var(--public-border)] bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Tạm tính</p>
          <p className="mt-1 text-lg font-semibold text-[var(--public-primary-dark)]">{amount ? formatCurrency(amount) : "Sẽ tính theo lựa chọn"}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--public-muted)]">
            {selection.serviceMode === "PACKAGE" && pack
              ? "Giá tạm tính dựa trên gói khám đã chọn, bao gồm các hạng mục đang được cấu hình trong gói."
              : selection.serviceMode === "DOCTOR_ONLY" && doctor
                ? "Giá tạm tính dựa trên phí khám của bác sĩ đã chọn. Chi phí cuối cùng có thể thay đổi sau khi bệnh viện xác nhận."
                : "Giá sẽ hiển thị sau khi bạn chọn hình thức khám và bác sĩ."}
          </p>
        </div>
      </div>

      {hotline ? (
        <div className="rounded-2xl bg-[var(--public-primary)] p-4 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/75">Hỗ trợ đặt lịch</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tabular-nums">{hotline}</p>
              <p className="mt-1 text-xs leading-5 text-white/75">Liên hệ khi cần hướng dẫn trong quá trình đặt lịch.</p>
            </div>
            <a href={`tel:${hotline}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--public-primary)] shadow-sm transition hover:bg-[var(--public-primary-soft)]" aria-label={`Gọi hỗ trợ ${hotline}`}>
              <Phone className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

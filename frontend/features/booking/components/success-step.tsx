import Link from "next/link";
import { CircleCheck, Copy } from "lucide-react";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { copyBookingCode } from "@/features/booking/components/copy-code";
import { formatDayShort } from "@/features/booking/dates";
import { doctorDisplayName } from "@/lib/doctor";
import { formatCurrency } from "@/lib/format";

const formatTime = (value: string) => value.slice(0, 5);

// Chỉ hiển thị sau khi máy chủ đã xác nhận OTP hợp lệ.
export function SuccessStep({ flow }: { flow: BookingFlow }) {
  const { verified, slot, selection } = flow.state;
  if (!verified) return null;
  const doctor = flow.catalog.doctors.find((item) => item.id === selection.doctorId);
  const day = slot ? formatDayShort(slot.date.slice(0, 10)) : "";

  return (
    <section aria-labelledby="booking-success" className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-6" role="status">
      <h2 id="booking-success" tabIndex={-1} className="flex items-start gap-3 text-xl font-bold leading-snug text-[var(--public-ink)] focus:outline-none">
        <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-[var(--public-success)]" aria-hidden="true" />
        Đã gửi yêu cầu đặt lịch. Chờ bệnh viện xác nhận.
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">Bạn sẽ nhận thông báo khi lịch được xác nhận. Lưu mã lịch dưới đây để tra cứu, thanh toán hoặc hủy lịch.</p>

      <div className="mt-5 rounded-lg border border-[var(--public-border)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Mã lịch</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="break-all font-mono text-xl font-semibold tracking-wide text-[var(--public-ink)]">{verified.bookingCode}</span>
          <button
            type="button"
            onClick={() => void copyBookingCode(verified.bookingCode, (message) => flow.dispatch({ type: "notice", message }))}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--public-border)] px-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Sao chép
          </button>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-[var(--public-divider)] border-y border-[var(--public-divider)] text-sm">
        {doctor ? <Row label="Bác sĩ" value={doctorDisplayName(doctor)} /> : null}
        <Row label="Thời gian" value={`${formatTime(verified.startTime)} - ${formatTime(verified.endTime)}${day ? `, ${day}` : ""}`} />
        <Row label="Trạng thái" value={verified.status === "PENDING_CONFIRM" ? "Chờ bệnh viện xác nhận" : verified.status} />
        <Row label="Phí dự kiến" value={formatCurrency(verified.finalAmount)} strong />
      </dl>
      <p className="mt-3 text-xs leading-5 text-[var(--public-muted)]">Hóa đơn và thanh toán trực tuyến có sau khi bệnh viện hoàn tất khám.</p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link href={`/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen&phone=${encodeURIComponent(verified.patientPhone)}`} className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-semibold">
          Xem lịch của tôi
        </Link>
        <button type="button" onClick={flow.actions.startNewBooking} className="public-button-secondary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-semibold">
          Đặt lịch khác
        </button>
      </div>
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-[var(--public-muted)]">{label}</dt>
      <dd className={`text-right ${strong ? "font-bold text-[var(--public-primary-dark)]" : "font-medium text-[var(--public-ink)]"}`}>{value}</dd>
    </div>
  );
}

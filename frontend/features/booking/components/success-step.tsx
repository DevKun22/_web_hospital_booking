import Link from "next/link";
import { CheckCircle2, CreditCard, Copy } from "lucide-react";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { copyBookingCode } from "@/features/booking/components/copy-code";
import { formatCurrency } from "@/lib/format";

const formatTime = (value: string) => value.slice(0, 5);

// Chỉ hiển thị sau khi máy chủ đã xác nhận OTP hợp lệ.
export function SuccessStep({ flow }: { flow: BookingFlow }) {
  const { verified } = flow.state;
  if (!verified) return null;

  return (
    <section aria-labelledby="booking-success" className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6" role="status">
      <h2 id="booking-success" tabIndex={-1} className="flex items-center gap-2 text-base font-bold text-emerald-800 focus:outline-none">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        Đã xác thực yêu cầu đặt lịch
      </h2>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Mã lịch cần lưu</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="break-all text-lg font-semibold text-[var(--public-ink)]">{verified.bookingCode}</span>
          <button
            type="button"
            onClick={() => void copyBookingCode(verified.bookingCode, (message) => flow.dispatch({ type: "notice", message }))}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Sao chép
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--public-muted)]">
          Hãy lưu mã này để tra cứu lịch, thanh toán, hủy lịch hoặc xem kết quả khám sau này.
        </p>
      </div>

      <dl className="mt-4 space-y-2 text-sm text-[var(--public-muted)]">
        <div className="flex gap-1">
          <dt>Trạng thái:</dt>
          <dd className="font-semibold text-[var(--public-ink)]">
            {verified.status === "PENDING_CONFIRM" ? "Chờ bệnh viện xác nhận" : verified.status}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Giờ khám:</dt>
          <dd>{formatTime(verified.startTime)} - {formatTime(verified.endTime)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Phí dự kiến:</dt>
          <dd>{formatCurrency(verified.finalAmount)}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--public-ink)]">
          <CreditCard className="h-4 w-4 text-[var(--public-primary-dark)]" aria-hidden="true" />
          Hóa đơn sau khi khám
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
          Hóa đơn và thanh toán online sẽ hiển thị trong trang tra cứu sau khi bệnh viện hoàn tất khám và phát hành hóa đơn.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen&phone=${encodeURIComponent(verified.patientPhone)}`}
          className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold"
        >
          Tra cứu lịch hẹn
        </Link>
        <button type="button" onClick={flow.actions.startNewBooking} className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold">
          Đặt lịch khác
        </button>
      </div>
    </section>
  );
}

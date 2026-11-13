import Link from "next/link";
import { Copy } from "lucide-react";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { StepFrame } from "@/features/booking/components/step-frame";
import { copyBookingCode } from "@/features/booking/components/copy-code";

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

export function VerifyStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, holdSeconds, resendCooldown, actions } = flow;
  const { pending, otp, submitting } = state;
  if (!pending) return null;

  const lookupHref = `/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen&phone=${encodeURIComponent(pending.patientPhone)}`;
  const urgent = pending.holdExpiresAt ? holdSeconds <= 60 : false;

  return (
    <StepFrame title="Nhập mã xác thực" description={`Mã 6 số đã gửi tới ${pending.patientPhone}. Lịch chỉ được giữ sau khi mã đúng.`}>
      {pending.holdExpiresAt ? (
        <p className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${urgent ? "bg-[var(--public-danger-soft)] text-[var(--public-danger)]" : "bg-[var(--public-warning-soft)] text-[var(--public-warning)]"}`}>
          <span className="font-medium">Giữ khung giờ còn</span>
          <strong className="text-base tabular-nums">{formatCountdown(holdSeconds)}</strong>
        </p>
      ) : null}

      <DebugOtpBox otp={pending.debugOtp} onFill={(value) => dispatch({ type: "otp_changed", otp: value })} />

      <label className="block">
        <span className="block text-sm font-semibold text-[var(--public-ink)]">Mã OTP</span>
        <input
          value={otp}
          onChange={(event) => dispatch({ type: "otp_changed", otp: event.target.value })}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          className="ui-field mt-1.5 w-full px-3 text-center text-2xl font-semibold tracking-[0.4em] tabular-nums"
        />
      </label>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <button type="button" onClick={() => void actions.resendOtp()} disabled={submitting || resendCooldown > 0} className="min-h-10 font-semibold text-[var(--public-primary)] underline underline-offset-4 disabled:text-[var(--public-muted)] disabled:no-underline">
          {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown} giây` : "Gửi lại mã"}
        </button>
        <button type="button" onClick={() => void actions.abandonPending()} disabled={submitting} className="min-h-10 font-semibold text-[var(--public-danger)] underline underline-offset-4 disabled:opacity-60">
          Đổi giờ khám
        </button>
      </div>

      <div className="rounded-lg border border-[var(--public-border)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Mã lịch của bạn</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="break-all font-mono text-lg font-semibold tracking-wide text-[var(--public-ink)]">{pending.bookingCode}</span>
          <button
            type="button"
            onClick={() => void copyBookingCode(pending.bookingCode, (message) => dispatch({ type: "notice", message }))}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--public-border)] px-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Sao chép
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--public-muted)]">
          Nếu lỡ thoát trang, vào <Link href={lookupHref} className="font-semibold text-[var(--public-primary)] underline underline-offset-2">Tra cứu lịch hẹn</Link> và nhập mã này cùng số điện thoại để xác thực lại.
        </p>
      </div>
    </StepFrame>
  );
}

import Link from "next/link";
import { Copy, Info, TimerReset } from "lucide-react";
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

  return (
    <StepFrame number={4} title="Xác thực OTP" description={`Nhập mã 6 số đã gửi tới ${pending.patientPhone}.`}>
      {pending.holdExpiresAt ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--public-warning)]/30 bg-[var(--public-warning-soft)] px-3 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-[var(--public-text-soft)]">
            <TimerReset className="h-4 w-4 text-[var(--public-warning)]" aria-hidden="true" />
            Giữ khung giờ còn
          </span>
          <strong className="tabular-nums text-[var(--public-warning)]">{formatCountdown(holdSeconds)}</strong>
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Mã đặt lịch cần lưu</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="break-all text-lg font-semibold text-[var(--public-ink)]">{pending.bookingCode}</span>
          <button
            type="button"
            onClick={() => void copyBookingCode(pending.bookingCode, (message) => dispatch({ type: "notice", message }))}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--public-border)] bg-white px-2 py-1.5 text-xs font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Sao chép
          </button>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] px-3 py-2.5 text-xs font-medium leading-5 text-[var(--public-primary-dark)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Nếu lỡ thoát màn hình này, hãy vào <Link href={lookupHref} className="font-semibold underline underline-offset-2">Tra cứu lịch hẹn</Link>, nhập mã lịch và số điện thoại để xác thực OTP lại.
        </span>
      </p>

      <DebugOtpBox otp={pending.debugOtp} onFill={(value) => dispatch({ type: "otp_changed", otp: value })} className="mt-3" />

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-[var(--public-text-soft)]">Mã OTP gồm 6 chữ số</span>
        <input
          value={otp}
          onChange={(event) => dispatch({ type: "otp_changed", otp: event.target.value })}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="ui-field mt-1 w-full px-3 py-3 text-center text-xl font-semibold tracking-[0.25em]"
        />
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void actions.verifyOtp()}
          disabled={submitting || otp.length !== 6}
          className="public-button-primary min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-60 sm:col-span-2"
        >
          Xác nhận OTP
        </button>
        <button
          type="button"
          onClick={() => void actions.resendOtp()}
          disabled={submitting || resendCooldown > 0}
          className="public-button-secondary min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown} giây` : "Gửi lại OTP"}
        </button>
        <button
          type="button"
          onClick={() => void actions.abandonPending()}
          disabled={submitting}
          className="min-h-11 rounded-xl border border-[var(--public-danger)]/30 px-4 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)] disabled:opacity-60"
        >
          Đổi lịch, trả khung giờ
        </button>
      </div>
    </StepFrame>
  );
}

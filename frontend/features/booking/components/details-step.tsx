import Link from "next/link";
import { CheckCircle2, Loader2, Phone, Send } from "lucide-react";
import type { BookingDraft } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { HealthSection } from "@/features/booking/components/health-section";
import { StepFrame } from "@/features/booking/components/step-frame";
import { sanitizePhoneInput } from "@/features/booking/validation";

const INPUT = "ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm";
const LABEL = "text-sm font-semibold text-[var(--public-ink)]";

export function DetailsStep({ flow, loading }: { flow: BookingFlow; loading: boolean }) {
  const { state, dispatch, otpChannels, otpChannel, profilePrefilled, actions } = flow;
  const { draft, submitting } = state;
  const set = (patch: Partial<BookingDraft>) => dispatch({ type: "draft_changed", patch });

  return (
    <div className="space-y-4">
      <StepFrame number={3} title="Thông tin người khám" description="Họ tên và số điện thoại là thông tin bắt buộc để tạo lịch và gửi OTP.">
        {profilePrefilled ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Đã tự điền thông tin từ hồ sơ tài khoản.
            </span>
            <Link href="/tai-khoan/ho-so" className="inline-flex min-h-8 items-center font-bold underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950">
              Kiểm tra hồ sơ
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Họ tên người khám <span className="text-[var(--public-danger)]">*</span></span>
            <input value={draft.patientName} onChange={(event) => set({ patientName: event.target.value })} className={INPUT} autoComplete="name" required />
          </label>

          <label className="block">
            <span className={LABEL}>Số điện thoại nhận OTP <span className="text-[var(--public-danger)]">*</span></span>
            <div className="relative mt-2">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
              <input
                value={draft.patientPhone}
                onChange={(event) => set({ patientPhone: sanitizePhoneInput(event.target.value) })}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                pattern="(0|\+84)[0-9]{9,10}"
                placeholder="0901234567"
                className="ui-field w-full px-3 py-3 pl-9 text-base sm:text-sm"
                required
              />
            </div>
            <span className="mt-1.5 block text-xs leading-5 text-[var(--public-muted)]">
              Dùng số bắt đầu bằng 0 hoặc +84. Số này cũng dùng để đăng nhập xem lại lịch hẹn.
            </span>
          </label>

          <label className="block">
            <span className={LABEL}>Kênh OTP</span>
            <select value={otpChannel} onChange={(event) => set({ otpChannel: event.target.value as BookingDraft["otpChannel"] })} className={INPUT}>
              {otpChannels.includes("EMAIL") ? <option value="EMAIL">Email</option> : null}
              {otpChannels.includes("SMS") ? <option value="SMS">SMS</option> : null}
            </select>
          </label>

          <label className="block">
            <span className={LABEL}>Email {otpChannel === "EMAIL" ? "(bắt buộc)" : "(không bắt buộc)"}</span>
            <input value={draft.patientEmail} onChange={(event) => set({ patientEmail: event.target.value })} placeholder="Nhập nếu xác thực qua email" type="email" autoComplete="email" className={INPUT} />
          </label>

          <label className="block md:col-span-2">
            <span className={LABEL}>Lý do khám</span>
            <textarea value={draft.reason} onChange={(event) => set({ reason: event.target.value })} rows={3} placeholder="Ví dụ: đau đầu, tái khám, tư vấn kết quả..." className={INPUT} />
          </label>
        </div>
      </StepFrame>

      <HealthSection flow={flow} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={() => actions.goToStep("schedule")} className="public-button-secondary inline-flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold">
          Quay lại
        </button>
        <button
          type="button"
          onClick={() => void actions.submitDetails()}
          disabled={submitting || loading}
          className="public-button-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold disabled:translate-y-0 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          Giữ lịch và gửi OTP
        </button>
        <span className="min-w-0 basis-full text-sm leading-6 text-[var(--public-muted)] lg:basis-auto lg:flex-1">
          Sau khi gửi mã, hệ thống sẽ hiển thị thời gian giữ khung giờ. Lịch chỉ chuyển sang chờ xác nhận sau khi OTP hợp lệ.{" "}
          <Link href="/huong-dan/dat-lich" className="font-semibold text-[var(--public-primary-dark)]">Cần hướng dẫn?</Link>
        </span>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import Link from "next/link";
import { TermsConsent } from "@/components/public/terms-consent";
import { CheckCircle2 } from "lucide-react";
import type { BookingDraft } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { HealthSection } from "@/features/booking/components/health-section";
import { Field, INPUT_CLASS, StepFrame } from "@/features/booking/components/step-frame";
import { sanitizePhoneInput } from "@/features/booking/validation";

export function DetailsStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, emailOtpAvailable, profilePrefilled } = flow;
  const { draft } = state;
  const set = (patch: Partial<BookingDraft>) => dispatch({ type: "draft_changed", patch });
  const emailInput = useRef<HTMLInputElement>(null);
  // Email bị từ chối: đưa con trỏ về ô Email để sửa ngay.
  useEffect(() => {
    if (state.emailError) emailInput.current?.focus();
  }, [state.emailError]);

  return (
    <div className="space-y-4">
      <StepFrame title="Thông tin người khám" description="Họ tên và email dùng để tạo lịch, gửi mã OTP và đăng nhập xem lại lịch hẹn.">
        {profilePrefilled ? (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--public-success-soft)] px-3 py-2.5 text-sm text-[var(--public-success)]" role="status">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Đã điền từ hồ sơ tài khoản
            </span>
            <Link href="/tai-khoan/ho-so" className="font-semibold underline underline-offset-4">Kiểm tra hồ sơ</Link>
          </p>
        ) : null}

        <Field label="Họ và tên" required>
          <input value={draft.patientName} onChange={(event) => set({ patientName: event.target.value })} className={INPUT_CLASS} autoComplete="name" required />
        </Field>

        <Field label="Email" required hint="Mã OTP gửi tới email này. Email cũng dùng để đăng nhập xem lại lịch hẹn." error={state.emailError}>
          <input ref={emailInput} value={draft.patientEmail} onChange={(event) => set({ patientEmail: event.target.value })} placeholder="ten@email.com" type="email" autoComplete="email" inputMode="email" aria-invalid={state.emailError ? true : undefined} className={INPUT_CLASS} required />
        </Field>
        {emailOtpAvailable ? null : (
          <p role="alert" className="rounded-lg bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm font-medium text-[var(--public-danger)]">
            Hệ thống tạm thời chưa gửi được mã xác thực qua email. Vui lòng thử lại sau hoặc liên hệ cơ sở khám.
          </p>
        )}

        <Field label="Số điện thoại" required hint="Để cơ sở khám liên hệ khi cần. Bắt đầu bằng 0 hoặc +84.">
          <input
            value={draft.patientPhone}
            onChange={(event) => set({ patientPhone: sanitizePhoneInput(event.target.value) })}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="(0|\+84)[0-9]{9,10}"
            placeholder="0901234567"
            className={INPUT_CLASS}
            required
          />
        </Field>

        <Field label="Lý do khám" hint="Không bắt buộc. Giúp bác sĩ chuẩn bị trước.">
          <textarea value={draft.reason} onChange={(event) => set({ reason: event.target.value })} rows={3} placeholder="Ví dụ: đau đầu 3 ngày, tái khám, tư vấn kết quả" className={`${INPUT_CLASS} py-2.5`} />
        </Field>
      </StepFrame>

      <HealthSection flow={flow} />

      {!flow.patient ? <TermsConsent checked={draft.termsAccepted} onChange={(termsAccepted) => set({ termsAccepted })} /> : null}
    </div>
  );
}

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { BookingDraft } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { HealthSection } from "@/features/booking/components/health-section";
import { Field, GroupLabel, INPUT_CLASS, StepFrame } from "@/features/booking/components/step-frame";
import { sanitizePhoneInput } from "@/features/booking/validation";

export function DetailsStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, otpChannels, otpChannel, profilePrefilled } = flow;
  const { draft } = state;
  const set = (patch: Partial<BookingDraft>) => dispatch({ type: "draft_changed", patch });

  return (
    <div className="space-y-4">
      <StepFrame title="Thông tin người khám" description="Họ tên và số điện thoại dùng để tạo lịch, gửi mã OTP và xem lại lịch hẹn.">
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

        <Field label="Số điện thoại" required hint="Bắt đầu bằng 0 hoặc +84. Số này cũng dùng để đăng nhập xem lại lịch hẹn.">
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

        <fieldset>
          <GroupLabel>Nhận mã OTP qua</GroupLabel>
          <div className="mt-1.5 grid grid-cols-2 rounded-lg border border-[var(--public-border)] p-1" role="group">
            {(["EMAIL", "SMS"] as const).map((channel) => {
              const available = otpChannels.includes(channel);
              const active = otpChannel === channel;
              return (
                <button
                  key={channel}
                  type="button"
                  aria-pressed={active}
                  disabled={!available}
                  onClick={() => set({ otpChannel: channel })}
                  className={`min-h-11 rounded-md px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? "bg-[var(--public-primary)] text-white" : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
                  }`}
                >
                  {channel === "EMAIL" ? "Email" : "Tin nhắn SMS"}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Email" required={otpChannel === "EMAIL"} hint={otpChannel === "EMAIL" ? "Mã OTP sẽ gửi tới email này." : "Không bắt buộc khi nhận OTP qua tin nhắn."}>
          <input value={draft.patientEmail} onChange={(event) => set({ patientEmail: event.target.value })} placeholder="ten@email.com" type="email" autoComplete="email" inputMode="email" className={INPUT_CLASS} />
        </Field>

        <Field label="Lý do khám" hint="Không bắt buộc. Giúp bác sĩ chuẩn bị trước.">
          <textarea value={draft.reason} onChange={(event) => set({ reason: event.target.value })} rows={3} placeholder="Ví dụ: đau đầu 3 ngày, tái khám, tư vấn kết quả" className={`${INPUT_CLASS} py-2.5`} />
        </Field>
      </StepFrame>

      <HealthSection flow={flow} />
    </div>
  );
}

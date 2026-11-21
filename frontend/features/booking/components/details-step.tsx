import { useEffect, useRef } from "react";
import Link from "next/link";
import { TermsConsent } from "@/components/public/terms-consent";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { todayInVietnam, type BookingDraft } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { HealthSection } from "@/features/booking/components/health-section";
import { Field, INPUT_CLASS, StepFrame } from "@/features/booking/components/step-frame";
import { sanitizePhoneInput, validateDetailFields, type DetailField } from "@/features/booking/validation";

const FIELD_LABELS: Record<DetailField, string> = {
  patientName: "Họ và tên",
  patientEmail: "Email",
  patientPhone: "Số điện thoại",
  dateOfBirth: "Ngày sinh",
  healthInsuranceCode: "Mã thẻ BHYT",
  healthConsent: "Đồng ý lưu thông tin sức khỏe",
};

export function DetailsStep({ flow }: { flow: BookingFlow }) {
  const { state, dispatch, emailOtpAvailable, profilePrefilled, termsRequired } = flow;
  const { draft, touched, submitAttempts } = state;
  const set = (patch: Partial<BookingDraft>) => dispatch({ type: "draft_changed", patch });
  const touch = (field: DetailField) => () => dispatch({ type: "field_touched", field });
  const root = useRef<HTMLDivElement>(null);

  const errors = validateDetailFields(draft, todayInVietnam());
  // Lỗi chỉ hiện ở ô đã rời đi hoặc sau khi bấm gửi; email bị máy chủ từ chối cũng hiện tại ô Email.
  const shown = (field: DetailField) => touched.includes(field) || submitAttempts > 0;
  const errorOf = (field: DetailField) => (field === "patientEmail" && state.emailError ? state.emailError : shown(field) ? errors[field] : "");
  const successOf = (field: DetailField, value: string) => touched.includes(field) && !errorOf(field) && Boolean(value.trim());
  const termsInvalid = termsRequired && submitAttempts > 0 && !draft.termsAccepted;

  const summary: { id: string; text: string }[] = [
    ...(Object.keys(errors) as DetailField[]).filter(() => submitAttempts > 0).map((field) => ({ id: field, text: `${FIELD_LABELS[field]}: ${errors[field]}` })),
    ...(termsInvalid ? [{ id: "booking-terms", text: "Điều khoản: chưa đồng ý điều khoản sử dụng." }] : []),
  ];

  const goTo = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  // Bấm gửi mà còn ô sai: cuộn tới ô sai đầu tiên và đặt tiêu điểm vào đó (không dùng thông báo nổi cho lỗi nhập liệu).
  // Email bị máy chủ từ chối cũng đưa con trỏ về ô Email.
  useEffect(() => {
    if (submitAttempts === 0 && !state.emailError) return;
    const target = root.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }, [submitAttempts, state.emailError]);

  return (
    <div ref={root} className="space-y-4">
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

        {summary.length ? (
          <div role="alert" className="rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]">
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Còn {summary.length} mục cần sửa
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-9">
              {summary.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      goTo(item.id);
                    }}
                    className="underline underline-offset-2"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Field label="Họ và tên" required fieldId="patientName" error={errorOf("patientName")} success={successOf("patientName", draft.patientName)}>
          <input value={draft.patientName} onChange={(event) => set({ patientName: event.target.value })} onBlur={touch("patientName")} className={INPUT_CLASS} autoComplete="name" />
        </Field>

        <Field label="Email" required fieldId="patientEmail" hint="Mã OTP gửi tới email này. Email cũng dùng để đăng nhập xem lại lịch hẹn." error={errorOf("patientEmail")} success={successOf("patientEmail", draft.patientEmail)}>
          <input value={draft.patientEmail} onChange={(event) => set({ patientEmail: event.target.value })} onBlur={touch("patientEmail")} type="email" autoComplete="email" inputMode="email" className={INPUT_CLASS} />
        </Field>
        {emailOtpAvailable ? null : (
          <p role="alert" className="rounded-lg bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm font-medium text-[var(--public-danger)]">
            Hệ thống tạm thời chưa gửi được mã xác thực qua email. Vui lòng thử lại sau hoặc liên hệ cơ sở khám.
          </p>
        )}

        <Field label="Số điện thoại" required fieldId="patientPhone" hint="Để cơ sở khám liên hệ khi cần. Bắt đầu bằng 0 hoặc +84." error={errorOf("patientPhone")} success={successOf("patientPhone", draft.patientPhone)}>
          <input
            value={draft.patientPhone}
            onChange={(event) => set({ patientPhone: sanitizePhoneInput(event.target.value) })}
            onBlur={touch("patientPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Lý do khám" hint="Không bắt buộc. Giúp bác sĩ chuẩn bị trước.">
          <textarea value={draft.reason} onChange={(event) => set({ reason: event.target.value })} rows={3} className={`${INPUT_CLASS} py-2.5`} />
        </Field>
      </StepFrame>

      <HealthSection flow={flow} />

      {!flow.patient ? <TermsConsent checked={draft.termsAccepted} onChange={(termsAccepted) => set({ termsAccepted })} invalid={termsInvalid} inputId="booking-terms" /> : null}
    </div>
  );
}

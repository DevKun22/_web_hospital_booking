"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { todayInVietnam } from "@/features/booking/model";
import { validateDetailFields, type DetailField } from "@/features/booking/validation";
import { hasHealthDeclaration, type BookingDraft } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { getVietnamYesterdayDateInput } from "@/lib/date";

const INPUT = "ui-field mt-1.5 w-full px-3 py-2.5 text-base sm:text-sm";
const LABEL = "text-sm font-semibold text-[var(--public-ink)]";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  wide?: boolean;
  fieldId?: string;
  error?: string;
};

const INVALID = "!border-[var(--public-danger)]";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-[var(--public-danger)]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function TextField({ label, value, onChange, onBlur, rows, wide, fieldId, error }: TextFieldProps) {
  const messageId = fieldId ? `${fieldId}-message` : undefined;
  const common = {
    id: fieldId,
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? messageId : undefined,
    className: `${INPUT} ${error ? INVALID : ""}`,
  };
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label htmlFor={fieldId} className={LABEL}>{label}</label>
      {rows ? <textarea {...common} rows={rows} /> : <input {...common} />}
      {messageId ? <FieldError id={messageId} message={error} /> : null}
    </div>
  );
}

// Phần hồ sơ y tế và BHYT: thu gọn mặc định, nhập thêm khi cần.
export function HealthSection({ flow }: { flow: BookingFlow }) {
  const { draft, touched, submitAttempts } = flow.state;
  const [open, setOpen] = useState(false);
  // Lỗi chỉ hiện ở ô đã rời đi hoặc sau khi bấm gửi; có lỗi sau khi gửi thì mở phần này để người dùng thấy ngay.
  const errors = validateDetailFields(draft, todayInVietnam());
  const errorOf = (key: DetailField) => (touched.includes(key) || submitAttempts > 0 ? errors[key] : undefined);
  const touch = (key: DetailField) => () => flow.dispatch({ type: "field_touched", field: key });
  const hasVisibleError = submitAttempts > 0 && Boolean(errors.dateOfBirth || errors.healthInsuranceCode || errors.healthConsent);
  const expanded = open || hasVisibleError;
  const set = (patch: Partial<BookingDraft>) => flow.dispatch({ type: "draft_changed", patch });
  const declared = hasHealthDeclaration(draft);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={expanded}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--public-surface-muted)]"
      >
        <span>
          <span className="block text-sm font-bold text-[var(--public-ink)]">Hồ sơ y tế và BHYT <span className="font-normal text-[var(--public-muted)]">(không bắt buộc)</span></span>
          <span className="mt-1 block text-sm leading-6 text-[var(--public-muted)]">
            Ngày sinh, BHYT và tiền sử bệnh. Có thể nhập để hồ sơ khám đầy đủ hơn.
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">
          {expanded ? "Ẩn bớt" : "Nhập thêm"}
        </span>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--public-divider)] p-4 md:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Giới tính</span>
            <select value={draft.gender} onChange={(event) => set({ gender: event.target.value as BookingDraft["gender"] })} className={INPUT}>
              <option value="">Chưa chọn</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>
          <div>
            <span className={LABEL}>Ngày sinh</span>
            <VietnamDateInput max={getVietnamYesterdayDateInput()} value={draft.dateOfBirth} onChange={(value) => { set({ dateOfBirth: value }); touch("dateOfBirth")(); }} ariaLabel="Ngày sinh" className={`${INPUT} ${errorOf("dateOfBirth") ? INVALID : ""}`} />
            <FieldError id="dateOfBirth-message" message={errorOf("dateOfBirth")} />
          </div>
          <TextField label="CCCD" value={draft.cccd} onChange={(cccd) => set({ cccd })} />
          <TextField label="Địa chỉ" value={draft.address} onChange={(address) => set({ address })} />

          <label className="flex items-center gap-2 rounded-md border border-[var(--public-border)] px-3 py-2 text-sm text-[var(--public-text-soft)]">
            <input type="checkbox" checked={draft.hasBHYT} onChange={(event) => set({ hasBHYT: event.target.checked })} />
            Có bảo hiểm y tế
          </label>
          {draft.hasBHYT ? (
            <>
              <TextField label="Mã thẻ BHYT" fieldId="healthInsuranceCode" value={draft.healthInsuranceCode} onChange={(healthInsuranceCode) => set({ healthInsuranceCode })} onBlur={touch("healthInsuranceCode")} error={errorOf("healthInsuranceCode")} />
              <TextField label="Nơi đăng ký khám chữa bệnh ban đầu" value={draft.registeredHospital} onChange={(registeredHospital) => set({ registeredHospital })} wide />
            </>
          ) : null}

          <TextField label="Dị ứng" value={draft.allergies} onChange={(allergies) => set({ allergies })} rows={2} wide />
          <TextField label="Tiền sử bệnh" value={draft.medicalHistory} onChange={(medicalHistory) => set({ medicalHistory })} rows={2} wide />
          <TextField label="Tiền sử gia đình" value={draft.familyHistory} onChange={(familyHistory) => set({ familyHistory })} rows={2} wide />

          {declared ? (
            <div className="md:col-span-2">
              <label className="flex items-start gap-2">
                <input id="healthConsent" type="checkbox" checked={draft.healthConsent} onChange={(event) => set({ healthConsent: event.target.checked })} onBlur={touch("healthConsent")} aria-invalid={errorOf("healthConsent") ? true : undefined} aria-describedby={errorOf("healthConsent") ? "healthConsent-message" : undefined} className="mt-1 h-4 w-4" />
                <span className="text-sm text-[var(--public-text-soft)]">
                  Tôi đồng ý cho bệnh viện lưu và sử dụng thông tin dị ứng, tiền sử sức khỏe trên để phục vụ khám bệnh. Thông tin chỉ nhân sự y tế có thẩm quyền được xem.
                </span>
              </label>
              <FieldError id="healthConsent-message" message={errorOf("healthConsent")} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

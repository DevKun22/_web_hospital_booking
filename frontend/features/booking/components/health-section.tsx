"use client";

import { useState } from "react";
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
  rows?: number;
  placeholder?: string;
  wide?: boolean;
};

function TextField({ label, value, onChange, rows, placeholder, wide }: TextFieldProps) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className={LABEL}>{label}</span>
      {rows ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className={INPUT} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={INPUT} />
      )}
    </label>
  );
}

// Phần hồ sơ y tế và BHYT: thu gọn mặc định, nhập thêm khi cần.
export function HealthSection({ flow }: { flow: BookingFlow }) {
  const { draft } = flow.state;
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<BookingDraft>) => flow.dispatch({ type: "draft_changed", patch });
  const declared = hasHealthDeclaration(draft);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--public-surface-muted)]"
      >
        <span>
          <span className="block text-sm font-bold text-[var(--public-ink)]">Hồ sơ y tế và BHYT <span className="font-normal text-[var(--public-muted)]">(không bắt buộc)</span></span>
          <span className="mt-1 block text-sm leading-6 text-[var(--public-muted)]">
            Ngày sinh, BHYT và tiền sử bệnh. Có thể nhập để hồ sơ khám đầy đủ hơn.
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">
          {open ? "Ẩn bớt" : "Nhập thêm"}
        </span>
      </button>

      {open ? (
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
          <label className="block">
            <span className={LABEL}>Ngày sinh</span>
            <VietnamDateInput max={getVietnamYesterdayDateInput()} value={draft.dateOfBirth} onChange={(value) => set({ dateOfBirth: value })} ariaLabel="Ngày sinh" className={INPUT} />
          </label>
          <TextField label="CCCD" value={draft.cccd} onChange={(cccd) => set({ cccd })} />
          <TextField label="Địa chỉ" value={draft.address} onChange={(address) => set({ address })} />

          <label className="flex items-center gap-2 rounded-md border border-[var(--public-border)] px-3 py-2 text-sm text-[var(--public-text-soft)]">
            <input type="checkbox" checked={draft.hasBHYT} onChange={(event) => set({ hasBHYT: event.target.checked })} />
            Có bảo hiểm y tế
          </label>
          {draft.hasBHYT ? (
            <>
              <TextField label="Mã thẻ BHYT" value={draft.healthInsuranceCode} onChange={(healthInsuranceCode) => set({ healthInsuranceCode })} />
              <TextField label="Nơi đăng ký khám chữa bệnh ban đầu" value={draft.registeredHospital} onChange={(registeredHospital) => set({ registeredHospital })} wide />
            </>
          ) : null}

          <TextField label="Dị ứng" value={draft.allergies} onChange={(allergies) => set({ allergies })} rows={2} placeholder="Thuốc, thức ăn hoặc tác nhân từng gây dị ứng" wide />
          <TextField label="Tiền sử bệnh" value={draft.medicalHistory} onChange={(medicalHistory) => set({ medicalHistory })} rows={2} placeholder="Bệnh nền, phẫu thuật, thuốc đang dùng..." wide />
          <TextField label="Tiền sử gia đình" value={draft.familyHistory} onChange={(familyHistory) => set({ familyHistory })} rows={2} placeholder="Các bệnh di truyền hoặc bệnh thường gặp trong gia đình" wide />

          {declared ? (
            <label className="flex items-start gap-2 md:col-span-2">
              <input type="checkbox" checked={draft.healthConsent} onChange={(event) => set({ healthConsent: event.target.checked })} className="mt-1 h-4 w-4" />
              <span className="text-sm text-[var(--public-text-soft)]">
                Tôi đồng ý cho bệnh viện lưu và sử dụng thông tin dị ứng, tiền sử sức khỏe trên để phục vụ khám bệnh. Thông tin chỉ nhân sự y tế có thẩm quyền được xem.
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

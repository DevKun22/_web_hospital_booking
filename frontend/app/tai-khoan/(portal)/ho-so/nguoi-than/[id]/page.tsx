"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useMutationToast } from "@/components/patient/patient-toast";
import { FIELD_CLASS, FoldSection, FormSection, PersonSwitcher, SaveBar, StateBadge } from "@/components/patient/profile-parts";
import { DEPENDENT_RELATIONSHIPS } from "@/features/booking/model";
import { useArchiveDependent, usePatientDependent, useUpdateDependent } from "@/features/portal/hooks";
import type { PatientDependent } from "@/lib/patient-portal-types";

type Draft = {
  fullName: string; relationship: string; dateOfBirth: string; gender: string; cccd: string; address: string;
  hasBHYT: boolean; healthInsuranceCode: string; registeredHospital: string;
  allergies: string; medicalHistory: string; familyHistory: string;
};

const nullable = (value: string) => value.trim() || null;
const draftFromDependent = (dependent: PatientDependent): Draft => ({
  fullName: dependent.fullName || "",
  relationship: dependent.relationship || "OTHER",
  dateOfBirth: dependent.dateOfBirth?.slice(0, 10) || "",
  gender: dependent.gender || "",
  cccd: dependent.cccd || "",
  address: dependent.address || "",
  hasBHYT: dependent.hasBHYT,
  healthInsuranceCode: dependent.healthInsuranceCode || "",
  registeredHospital: dependent.registeredHospital || "",
  allergies: dependent.allergies || "",
  medicalHistory: dependent.medicalHistory || "",
  familyHistory: dependent.familyHistory || "",
});

function DependentForm({ dependent }: { dependent: PatientDependent }) {
  const router = useRouter();
  const [initial] = useState(() => draftFromDependent(dependent));
  const [draft, setDraft] = useState<Draft>(initial);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const update = useUpdateDependent(dependent.id);
  useMutationToast(update, { success: "Đã cập nhật hồ sơ người thân.", fallbackError: "Không thể cập nhật hồ sơ." });
  const archive = useArchiveDependent();
  useMutationToast(archive, { success: "Đã ngừng quản lý hồ sơ.", fallbackError: "Không thể ngừng quản lý hồ sơ." });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const hasHealth = Boolean(initial.allergies.trim() || initial.medicalHistory.trim() || initial.familyHistory.trim());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Email và số điện thoại lấy từ tài khoản khi đặt lịch, nên không gửi hai trường này.
    update.mutate({
      fullName: draft.fullName.trim(),
      relationship: draft.relationship,
      dateOfBirth: nullable(draft.dateOfBirth),
      gender: draft.gender || null,
      cccd: nullable(draft.cccd),
      address: nullable(draft.address),
      hasBHYT: draft.hasBHYT,
      healthInsuranceCode: draft.hasBHYT ? nullable(draft.healthInsuranceCode) : null,
      registeredHospital: draft.hasBHYT ? nullable(draft.registeredHospital) : null,
      allergies: nullable(draft.allergies),
      medicalHistory: nullable(draft.medicalHistory),
      familyHistory: nullable(draft.familyHistory),
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4">
        <FormSection title="Thông tin chung">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Họ và tên <span className="text-[var(--public-danger)]">*</span><input className={FIELD_CLASS} value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} required minLength={2} /></label>
            <label className="text-sm font-semibold">Mối quan hệ<select className={FIELD_CLASS} value={draft.relationship} onChange={(e) => set("relationship", e.target.value)}>{Object.entries(DEPENDENT_RELATIONSHIPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-semibold">Ngày sinh<VietnamDateInput className={FIELD_CLASS} ariaLabel="Ngày sinh" value={draft.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(value) => set("dateOfBirth", value)} /></label>
            <label className="text-sm font-semibold">Giới tính<select className={FIELD_CLASS} value={draft.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
            <label className="text-sm font-semibold">CCCD/Định danh<input className={FIELD_CLASS} inputMode="numeric" value={draft.cccd} onChange={(e) => set("cccd", e.target.value.replace(/\D/g, "").slice(0, 20))} /></label>
            <label className="text-sm font-semibold">Địa chỉ<input className={FIELD_CLASS} value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={300} /></label>
          </div>
          <p className="mt-3 text-xs text-[var(--public-muted)]">Email và số điện thoại lấy từ tài khoản của bạn khi đặt lịch.</p>
        </FormSection>

        <FormSection title="Bảo hiểm y tế" badge={<StateBadge tone={draft.hasBHYT ? "ok" : "warn"}>{draft.hasBHYT ? "Có thẻ" : "Chưa có thẻ"}</StateBadge>}>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.hasBHYT} onChange={(e) => set("hasBHYT", e.target.checked)} className="h-4 w-4" /> Người này có thẻ BHYT</label>
          {draft.hasBHYT ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Mã thẻ BHYT <span className="text-[var(--public-danger)]">*</span><input className={FIELD_CLASS} value={draft.healthInsuranceCode} onChange={(e) => set("healthInsuranceCode", e.target.value)} required /></label>
              <label className="text-sm font-semibold">Nơi đăng ký khám ban đầu<input className={FIELD_CLASS} value={draft.registeredHospital} onChange={(e) => set("registeredHospital", e.target.value)} /></label>
            </div>
          ) : null}
        </FormSection>

        <FoldSection title="Sức khỏe" hint="Dị ứng, tiền sử, tiền sử gia đình" badge={<StateBadge tone={hasHealth ? "ok" : "warn"}>{hasHealth ? "Đã lưu" : "Chưa có"}</StateBadge>}>
          <div className="grid gap-4">
            <label className="text-sm font-semibold">Dị ứng<textarea className={`${FIELD_CLASS} min-h-24 py-3`} value={draft.allergies} onChange={(e) => set("allergies", e.target.value)} /></label>
            <label className="text-sm font-semibold">Tiền sử sức khỏe<textarea className={`${FIELD_CLASS} min-h-24 py-3`} value={draft.medicalHistory} onChange={(e) => set("medicalHistory", e.target.value)} /></label>
            <label className="text-sm font-semibold">Tiền sử gia đình<textarea className={`${FIELD_CLASS} min-h-24 py-3`} value={draft.familyHistory} onChange={(e) => set("familyHistory", e.target.value)} /></label>
          </div>
        </FoldSection>

        <SaveBar dirty={dirty} pending={update.isPending} />
      </form>

      <section className="rounded-xl border border-[var(--public-danger)] bg-[var(--public-surface)] p-4 sm:p-5">
        <h2 className="text-base font-bold text-[var(--public-danger)]">Ngừng quản lý hồ sơ này</h2>
        <p className="mt-1 text-sm text-[var(--public-text-soft)]">Lịch đã đặt cho {dependent.fullName} vẫn được giữ. Bạn không chọn được người này khi đặt lịch mới.</p>
        {confirmArchive ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={archive.isPending}
              onClick={() => archive.mutate(dependent.id, { onSuccess: () => router.replace("/tai-khoan/ho-so") })}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--public-danger)] px-4 text-sm font-semibold text-white disabled:opacity-70"
            >
              {archive.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Xác nhận ngừng quản lý
            </button>
            <button type="button" onClick={() => setConfirmArchive(false)} className="public-button-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">Giữ hồ sơ</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmArchive(true)} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[var(--public-danger)] px-4 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)]">
            Ngừng quản lý {dependent.fullName}
          </button>
        )}
      </section>
    </div>
  );
}

export default function PatientDependentEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = usePatientDependent(id);

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Hồ sơ và người thân" description="Chọn một người để xem và sửa thông tin. Hồ sơ đầy đủ giúp điền nhanh khi đặt lịch." />
      <PersonSwitcher selected={id} />
      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hồ sơ người thân."} onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <PatientEmptyState
          title="Không tìm thấy hồ sơ"
          description="Hồ sơ có thể đã ngừng được quản lý hoặc không thuộc tài khoản này."
          action={<button type="button" onClick={() => router.replace("/tai-khoan/ho-so")} className="public-button-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">Về trang hồ sơ</button>}
        />
      ) : (
        <DependentForm key={JSON.stringify(draftFromDependent(query.data))} dependent={query.data} />
      )}
    </div>
  );
}

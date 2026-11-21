"use client";

import { useState, type FormEvent } from "react";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { useMutationToast } from "@/components/patient/patient-toast";
import { PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { FIELD_CLASS, FoldSection, FormSection, PersonSwitcher, READONLY_CLASS, SaveBar, StateBadge } from "@/components/patient/profile-parts";
import { usePatientAuth } from "@/lib/patient-auth";
import type { PatientUser } from "@/lib/patient-portal-types";
import { usePatientProfile, useUpdateProfile } from "@/features/portal/hooks";

type ProfileDraft = { fullName: string; dateOfBirth: string; gender: string; cccd: string; address: string; hasBHYT: boolean; healthInsuranceCode: string; registeredHospital: string; bloodType: string; height: string; weight: string; allergies: string; medicalHistory: string };
const nullable = (value: string) => value.trim() || null;
// Phải khớp HEALTH_CONSENT_VERSION ở backend/src/services/appointment.service.ts.
const HEALTH_CONSENT_VERSION = "2026-11";

const draftFromProfile = (profile: PatientUser): ProfileDraft => {
  const detail = profile.patientProfile;
  return {
    fullName: profile.fullName || "",
    dateOfBirth: detail?.dateOfBirth?.slice(0, 10) || "",
    gender: detail?.gender || "",
    cccd: detail?.cccd || "",
    address: detail?.address || "",
    hasBHYT: detail?.hasBHYT || false,
    healthInsuranceCode: detail?.healthInsuranceCode || "",
    registeredHospital: detail?.registeredHospital || "",
    bloodType: detail?.bloodType || "",
    height: detail?.height?.toString() || "",
    weight: detail?.weight?.toString() || "",
    allergies: detail?.allergies || "",
    medicalHistory: detail?.medicalHistory || "",
  };
};

function ProfileForm({ profile }: { profile: PatientUser }) {
  const { refreshUser } = usePatientAuth();
  const detail = profile.patientProfile;
  const [initial] = useState(() => draftFromProfile(profile));
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [healthConsent, setHealthConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const mutation = useUpdateProfile(async () => { await refreshUser(); });
  useMutationToast(mutation, { success: "Đã cập nhật hồ sơ.", fallbackError: "Không thể lưu hồ sơ." });
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const savedAllergies = (detail?.allergies || "").trim();
  const savedHistory = (detail?.medicalHistory || "").trim();
  const hadHealthConsent = detail?.healthConsentVersion === HEALTH_CONSENT_VERSION;
  const hasHealthText = draft.allergies.trim() !== "" || draft.medicalHistory.trim() !== "";
  const changesHealthData = (draft.allergies.trim() !== "" && draft.allergies.trim() !== savedAllergies) || (draft.medicalHistory.trim() !== "" && draft.medicalHistory.trim() !== savedHistory);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changesHealthData && !hadHealthConsent && !healthConsent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    mutation.mutate({
      fullName: draft.fullName.trim(),
      dateOfBirth: nullable(draft.dateOfBirth),
      gender: draft.gender || null,
      cccd: nullable(draft.cccd),
      address: nullable(draft.address),
      hasBHYT: draft.hasBHYT,
      healthInsuranceCode: draft.hasBHYT ? nullable(draft.healthInsuranceCode) : null,
      registeredHospital: draft.hasBHYT ? nullable(draft.registeredHospital) : null,
      bloodType: nullable(draft.bloodType),
      height: draft.height ? Number(draft.height) : null,
      weight: draft.weight ? Number(draft.weight) : null,
      allergies: nullable(draft.allergies),
      medicalHistory: nullable(draft.medicalHistory),
      ...(healthConsent ? { healthConsent: true } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormSection title="Thông tin chung">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Họ và tên <span className="text-[var(--public-danger)]">*</span><input className={FIELD_CLASS} value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} required minLength={2} /></label>
          <label className="text-sm font-semibold">Ngày sinh<VietnamDateInput className={FIELD_CLASS} ariaLabel="Ngày sinh" value={draft.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(value) => set("dateOfBirth", value)} /></label>
          <label className="text-sm font-semibold">Giới tính<select className={FIELD_CLASS} value={draft.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
          <label className="text-sm font-semibold">CCCD/Định danh<input className={FIELD_CLASS} value={draft.cccd} onChange={(e) => set("cccd", e.target.value.replace(/\D/g, "").slice(0, 20))} inputMode="numeric" /></label>
          <label className="text-sm font-semibold">Email đăng nhập<input className={READONLY_CLASS} value={profile.email || ""} readOnly aria-readonly="true" /></label>
          <label className="text-sm font-semibold">Số điện thoại<input className={READONLY_CLASS} value={profile.phone || ""} readOnly aria-readonly="true" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Địa chỉ<input className={FIELD_CLASS} value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={300} /></label>
        </div>
      </FormSection>

      <FormSection title="Bảo hiểm y tế" badge={<StateBadge tone={draft.hasBHYT ? "ok" : "warn"}>{draft.hasBHYT ? "Có thẻ" : "Chưa có thẻ"}</StateBadge>}>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.hasBHYT} onChange={(e) => set("hasBHYT", e.target.checked)} className="h-4 w-4" /> Tôi có thẻ BHYT</label>
        {draft.hasBHYT ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Mã thẻ BHYT <span className="text-[var(--public-danger)]">*</span><input className={FIELD_CLASS} value={draft.healthInsuranceCode} onChange={(e) => set("healthInsuranceCode", e.target.value)} required /></label>
            <label className="text-sm font-semibold">Nơi đăng ký khám ban đầu<input className={FIELD_CLASS} value={draft.registeredHospital} onChange={(e) => set("registeredHospital", e.target.value)} /></label>
          </div>
        ) : null}
      </FormSection>

      <FoldSection title="Sức khỏe" hint="Nhóm máu, dị ứng, tiền sử" badge={<StateBadge tone={savedAllergies || savedHistory ? "ok" : "warn"}>{savedAllergies || savedHistory ? "Đã lưu" : "Chưa có"}</StateBadge>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold">Nhóm máu<input className={FIELD_CLASS} value={draft.bloodType} onChange={(e) => set("bloodType", e.target.value)} /></label>
          <label className="text-sm font-semibold">Chiều cao (cm)<input className={FIELD_CLASS} type="number" min="1" max="300" value={draft.height} onChange={(e) => set("height", e.target.value)} /></label>
          <label className="text-sm font-semibold">Cân nặng (kg)<input className={FIELD_CLASS} type="number" min="1" max="500" value={draft.weight} onChange={(e) => set("weight", e.target.value)} /></label>
          <label className="text-sm font-semibold sm:col-span-3">Dị ứng<textarea className={`${FIELD_CLASS} min-h-24 py-3`} value={draft.allergies} onChange={(e) => set("allergies", e.target.value)} /></label>
          <label className="text-sm font-semibold sm:col-span-3">Tiền sử sức khỏe<textarea className={`${FIELD_CLASS} min-h-24 py-3`} value={draft.medicalHistory} onChange={(e) => set("medicalHistory", e.target.value)} /></label>
        </div>
        {hasHealthText && !hadHealthConsent ? (
          <label className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--public-border)] p-4 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={healthConsent} onChange={(e) => { setHealthConsent(e.target.checked); setConsentError(false); }} />
            <span><strong>Đồng ý lưu thông tin sức khỏe.</strong> Tôi đồng ý cho cơ sở khám lưu dị ứng và tiền sử bệnh để phục vụ khám chữa bệnh. Tôi có thể xóa các nội dung này bất cứ lúc nào.</span>
          </label>
        ) : null}
        {consentError ? <p role="alert" className="mt-4 rounded-lg bg-[var(--public-danger-soft)] p-3 text-sm text-[var(--public-danger)]">Đồng ý lưu thông tin sức khỏe để cập nhật dị ứng và tiền sử.</p> : null}
      </FoldSection>

      <SaveBar dirty={dirty} pending={mutation.isPending} />
    </form>
  );
}

export default function PatientProfilePage() {
  const query = usePatientProfile();
  return (
    <div className="space-y-5">
      <PatientPageHeader title="Hồ sơ và người thân" description="Chọn một người để xem và sửa thông tin. Hồ sơ đầy đủ giúp điền nhanh khi đặt lịch." />
      <PersonSwitcher selected="self" />
      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError || !query.data ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hồ sơ."} onRetry={() => query.refetch()} />
      ) : (
        <ProfileForm key={`${query.data.profile.id}-${query.data.profile.email}-${JSON.stringify(draftFromProfile(query.data.profile))}`} profile={query.data.profile} />
      )}
    </div>
  );
}


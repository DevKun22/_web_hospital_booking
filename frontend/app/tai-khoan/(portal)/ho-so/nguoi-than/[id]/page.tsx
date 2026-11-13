"use client";

import { VietnamDateInput } from "@/components/ui/vietnam-date-input";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import type { PatientDependent } from "@/lib/patient-portal-types";

import { usePatientDependent, useUpdateDependent } from "@/features/portal/hooks";
type Draft = {
  fullName: string; relationship: string; phone: string; email: string; dateOfBirth: string;
  gender: string; cccd: string; address: string; hasBHYT: boolean; healthInsuranceCode: string;
  registeredHospital: string; allergies: string; medicalHistory: string; familyHistory: string;
};

const emptyDraft: Draft = { fullName: "", relationship: "OTHER", phone: "", email: "", dateOfBirth: "", gender: "", cccd: "", address: "", hasBHYT: false, healthInsuranceCode: "", registeredHospital: "", allergies: "", medicalHistory: "", familyHistory: "" };
const nullable = (value: string) => value.trim() || null;
const draftFromDependent = (dependent: PatientDependent): Draft => ({ fullName: dependent.fullName || "", relationship: dependent.relationship || "OTHER", phone: dependent.phone || "", email: dependent.email || "", dateOfBirth: dependent.dateOfBirth?.slice(0, 10) || "", gender: dependent.gender || "", cccd: dependent.cccd || "", address: dependent.address || "", hasBHYT: dependent.hasBHYT, healthInsuranceCode: dependent.healthInsuranceCode || "", registeredHospital: dependent.registeredHospital || "", allergies: dependent.allergies || "", medicalHistory: dependent.medicalHistory || "", familyHistory: dependent.familyHistory || "" });

export default function PatientDependentEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editedDraft, setEditedDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  const query = usePatientDependent(id);
  const draft = editedDraft ?? (query.data ? draftFromDependent(query.data) : emptyDraft);

  const mutation = useUpdateDependent(id, () => { setSaved(true); window.setTimeout(() => setSaved(false), 3000); });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setEditedDraft((current) => ({ ...(current ?? draft), [key]: value }));
  const input = "mt-2 min-h-11 w-full rounded-xl border border-[var(--public-border)] bg-white px-3 text-sm outline-none focus:border-[var(--public-primary)]";

  return <div className="space-y-6">
    <Link href="/tai-khoan/ho-so" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--public-primary)]"><ArrowLeft className="h-4 w-4" /> Quay lại hồ sơ</Link>
    <PatientPageHeader title="Chỉnh sửa thông tin" description="Thông tin đã lưu sẽ được dùng để tự điền khi bạn đặt lịch thay cho người thân." />
    {query.isLoading ? <PatientPageLoading /> : query.isError ? <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hồ sơ người thân."} onRetry={() => query.refetch()} /> : !query.data ? <PatientEmptyState title="Không tìm thấy hồ sơ" description="Hồ sơ có thể đã ngừng được quản lý hoặc không thuộc tài khoản này." action={<button type="button" onClick={() => router.replace("/tai-khoan/ho-so")} className="public-button-secondary min-h-11 rounded-xl px-4 text-sm font-bold">Về trang hồ sơ</button>} /> : <form onSubmit={(event: FormEvent) => { event.preventDefault(); mutation.mutate({ ...draft, phone: nullable(draft.phone), email: nullable(draft.email), dateOfBirth: nullable(draft.dateOfBirth), gender: draft.gender || null, cccd: nullable(draft.cccd), address: nullable(draft.address), healthInsuranceCode: draft.hasBHYT ? nullable(draft.healthInsuranceCode) : null, registeredHospital: draft.hasBHYT ? nullable(draft.registeredHospital) : null, allergies: nullable(draft.allergies), medicalHistory: nullable(draft.medicalHistory), familyHistory: nullable(draft.familyHistory) }); }} className="rounded-xl border border-[var(--public-border)] bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">Họ và tên <span className="text-[var(--public-danger)]">*</span><input className={input} value={draft.fullName} onChange={(event) => set("fullName", event.target.value)} required minLength={2} /></label>
        <label className="text-sm font-semibold">Mối quan hệ<select className={input} value={draft.relationship} onChange={(event) => set("relationship", event.target.value)}><option value="CHILD">Con</option><option value="SPOUSE">Vợ/chồng</option><option value="PARENT">Cha/mẹ</option><option value="SIBLING">Anh/chị/em</option><option value="OTHER">Khác</option></select></label>
        <label className="text-sm font-semibold">Ngày sinh<VietnamDateInput className={input} ariaLabel="Ngày sinh" value={draft.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(value) => set("dateOfBirth", value)} /></label>
        <label className="text-sm font-semibold">Giới tính<select className={input} value={draft.gender} onChange={(event) => set("gender", event.target.value)}><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
        <label className="text-sm font-semibold">Số điện thoại<input className={input} inputMode="tel" value={draft.phone} onChange={(event) => set("phone", event.target.value)} /></label>
        <label className="text-sm font-semibold">Email<input className={input} type="email" value={draft.email} onChange={(event) => set("email", event.target.value)} /></label>
        <label className="text-sm font-semibold">CCCD/Định danh<input className={input} inputMode="numeric" value={draft.cccd} onChange={(event) => set("cccd", event.target.value.replace(/\D/g, "").slice(0, 20))} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Địa chỉ<input className={input} value={draft.address} onChange={(event) => set("address", event.target.value)} maxLength={300} /></label>
      </div>
      <fieldset className="mt-6 rounded-lg border border-[var(--public-border)] p-4"><legend className="px-2 text-sm font-bold">Bảo hiểm y tế</legend><label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.hasBHYT} onChange={(event) => set("hasBHYT", event.target.checked)} className="h-4 w-4" /> Người thân có thẻ BHYT</label>{draft.hasBHYT ? <div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Mã thẻ BHYT <span className="text-[var(--public-danger)]">*</span><input className={input} value={draft.healthInsuranceCode} onChange={(event) => set("healthInsuranceCode", event.target.value)} required /></label><label className="text-sm font-semibold">Nơi đăng ký khám ban đầu<input className={input} value={draft.registeredHospital} onChange={(event) => set("registeredHospital", event.target.value)} /></label></div> : null}</fieldset>
      <details className="mt-5 rounded-lg border border-[var(--public-border)] p-4"><summary className="cursor-pointer text-sm font-bold">Thông tin sức khỏe bổ sung</summary><div className="mt-4 grid gap-4"><label className="text-sm font-semibold">Dị ứng<textarea className={`${input} min-h-24 py-3`} value={draft.allergies} onChange={(event) => set("allergies", event.target.value)} /></label><label className="text-sm font-semibold">Tiền sử sức khỏe<textarea className={`${input} min-h-24 py-3`} value={draft.medicalHistory} onChange={(event) => set("medicalHistory", event.target.value)} /></label><label className="text-sm font-semibold">Tiền sử gia đình<textarea className={`${input} min-h-24 py-3`} value={draft.familyHistory} onChange={(event) => set("familyHistory", event.target.value)} /></label></div></details>
      {mutation.isError ? <p role="alert" className="mt-4 rounded-xl bg-[var(--public-danger-soft)] p-3 text-sm text-[var(--public-danger)]">{mutation.error instanceof Error ? mutation.error.message : "Không thể cập nhật hồ sơ."}</p> : null}{saved ? <p aria-live="polite" className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--public-success-soft)] p-3 text-sm font-semibold text-[var(--public-success)]"><CheckCircle2 className="h-4 w-4" /> Đã cập nhật hồ sơ người thân.</p> : null}
      <div className="mt-5 flex justify-end"><button disabled={mutation.isPending} className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-60">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thay đổi</button></div>
    </form>}
  </div>;
}

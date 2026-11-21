import type { PatientAppointment } from "@/lib/patient-portal-types";

// Tên người khám kèm nhãn Bản thân/Người thân; lịch cũ chưa gắn hồ sơ người thân tính là Bản thân.
export function PersonName({ item }: { item: Pick<PatientAppointment, "patientName" | "dependentProfileId"> }) {
  const own = !item.dependentProfileId;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">{item.patientName}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${own ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" : "bg-[var(--public-surface-muted)] text-[var(--public-text-soft)]"}`}>{own ? "Bản thân" : "Người thân"}</span>
    </span>
  );
}

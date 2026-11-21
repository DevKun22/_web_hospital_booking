"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { collectPeople, PersonFilter } from "@/components/patient/person-filter";
import { PersonName } from "@/components/patient/person-tag";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useHealthRecords } from "@/features/portal/hooks";
import { formatShortDate } from "@/lib/format";

type Tab = "records" | "prescriptions";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "records", label: "Kết quả khám" },
  { key: "prescriptions", label: "Đơn thuốc" },
];

const doctorLabel = (doctor: { title?: string | null; user: { fullName: string } }) => `${doctor.title ? `${doctor.title} ` : ""}${doctor.user.fullName}`;
const LIST_CLASS = "divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]";
const ROW_CLASS = "flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--public-surface-muted)]";
const BADGE = "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold";

type PersonRef = { patientName?: string; dependentProfileId?: string | null };
const personKey = (appointment?: PersonRef) => appointment?.dependentProfileId || "";

export default function HealthRecordsPage() {
  const [tab, setTab] = useState<Tab>("records");
  const [person, setPerson] = useState<string | null>(null);
  const query = useHealthRecords();
  const records = useMemo(() => query.data?.records ?? [], [query.data]);
  const prescriptions = useMemo(() => query.data?.prescriptions ?? [], [query.data]);

  const people = useMemo(
    () => collectPeople([...records.map((item) => item.appointment), ...prescriptions.map((item) => item.appointment)], personKey, (item) => item?.patientName || ""),
    [records, prescriptions],
  );
  const active = person !== null && people.some(([key]) => key === person) ? person : null;
  const visibleRecords = records.filter((item) => active === null || personKey(item.appointment) === active);
  const visiblePrescriptions = prescriptions.filter((item) => active === null || personKey(item.appointment) === active);

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Hồ sơ sức khỏe" description="Kết quả khám và đơn thuốc đã được cơ sở khám công bố." />

      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError || !query.data ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hồ sơ sức khỏe."} onRetry={() => query.refetch()} />
      ) : (
        <>
          <PersonFilter people={people} active={active} onChange={setPerson} />

          <div role="tablist" aria-label="Loại hồ sơ" className="flex gap-6 border-b border-[var(--public-border)]">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`-mb-px min-h-11 border-b-2 text-sm font-semibold transition-colors ${tab === item.key ? "border-[var(--public-primary)] text-[var(--public-primary-dark)]" : "border-transparent text-[var(--public-muted)] hover:text-[var(--public-ink)]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "records" ? (
            visibleRecords.length ? (
              <ul className={LIST_CLASS}>
                {visibleRecords.map((record) => (
                  <li key={record.id}>
                    <Link href={`/tai-khoan/ho-so-suc-khoe/ket-qua/${record.id}`} className={ROW_CLASS}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold"><PersonName item={{ patientName: record.appointment.patientName, dependentProfileId: record.appointment.dependentProfileId }} /></span>
                        <span className="block truncate text-xs text-[var(--public-muted)]">{formatShortDate(record.publishedAt || record.createdAt)} · {doctorLabel(record.doctor)} · {record.recordCode}</span>
                        <span className="mt-0.5 block truncate text-sm text-[var(--public-text-soft)]">{record.diagnosis || "Chưa có nội dung chẩn đoán"}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {record.labResults.length ? <span className={`${BADGE} bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]`}>{record.labResults.length} xét nghiệm</span> : null}
                        {record.resultFile?.available ? <span className="inline-flex items-center gap-1 text-xs text-[var(--public-muted)]"><Paperclip className="h-3 w-3" aria-hidden="true" />Có tệp</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <PatientEmptyState title="Chưa có kết quả khám" description="Kết quả xuất hiện sau khi bác sĩ hoàn tất và cơ sở khám công bố hồ sơ." />
            )
          ) : visiblePrescriptions.length ? (
            <ul className={LIST_CLASS}>
              {visiblePrescriptions.map((prescription) => {
                const buyOutside = prescription.items.filter((item) => item.fulfillmentStatus === "OUT_OF_STOCK" || item.fulfillmentStatus === "OUTSIDE").length;
                const appointment = prescription.appointment;
                return (
                  <li key={prescription.id}>
                    <Link href={`/tai-khoan/ho-so-suc-khoe/don-thuoc/${prescription.id}`} className={ROW_CLASS}>
                      <span className="min-w-0 flex-1">
                        {appointment?.patientName ? <span className="block text-sm font-semibold"><PersonName item={{ patientName: appointment.patientName, dependentProfileId: appointment.dependentProfileId }} /></span> : null}
                        <span className="block truncate text-xs text-[var(--public-muted)]">{formatShortDate(prescription.issuedAt || prescription.createdAt)} · {doctorLabel(prescription.doctor)} · {prescription.prescriptionCode}</span>
                        <span className="mt-0.5 block truncate text-sm text-[var(--public-text-soft)]">{prescription.items.map((item) => item.medicineName).join(", ")}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-[var(--public-muted)]">{prescription.items.length} thuốc</span>
                        {buyOutside ? <span className={`${BADGE} bg-[var(--public-warning-soft)] text-[var(--public-warning)]`}>{buyOutside} cần mua ngoài</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <PatientEmptyState title="Chưa có đơn thuốc" description="Đơn thuốc xuất hiện sau khi bác sĩ phát hành chính thức." />
          )}
        </>
      )}
    </div>
  );
}

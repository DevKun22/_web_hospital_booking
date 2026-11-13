"use client";

import Link from "next/link";
import { useState } from "react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useHealthRecords } from "@/features/portal/hooks";
import { formatShortDate } from "@/lib/format";

type Tab = "records" | "prescriptions";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "records", label: "Kết quả khám" },
  { key: "prescriptions", label: "Đơn thuốc" },
];

const doctorLabel = (doctor: { title?: string | null; user: { fullName: string } }) => `${doctor.title ? `${doctor.title} ` : ""}${doctor.user.fullName}`;
const LIST_CLASS = "divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]";
const LINK_CLASS = "mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4";

export default function HealthRecordsPage() {
  const [tab, setTab] = useState<Tab>("records");
  const query = useHealthRecords();

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Kết quả khám và đơn thuốc" description="Chỉ hiển thị hồ sơ đã được bệnh viện công bố, đồng bộ với ứng dụng di động." />

      <div role="tablist" aria-label="Loại hồ sơ" className="flex gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${tab === item.key ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-text-soft)]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError || !query.data ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được hồ sơ sức khỏe."} onRetry={() => query.refetch()} />
      ) : tab === "records" ? (
        query.data.records.length ? (
          <ul className={LIST_CLASS}>
            {query.data.records.map((record) => (
              <li key={record.id} className="p-4 sm:p-5">
                <p className="text-sm text-[var(--public-muted)]">{formatShortDate(record.publishedAt || record.createdAt)} · {doctorLabel(record.doctor)}</p>
                <h2 className="mt-0.5 text-base font-bold">Phiếu khám {record.recordCode}</h2>
                <p className="mt-2 text-base text-[var(--public-text-soft)]"><span className="text-[var(--public-muted)]">Chẩn đoán: </span>{record.diagnosis || "Chưa có nội dung chẩn đoán"}</p>
                {record.labResults.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-[var(--public-text-soft)]">
                    {record.labResults.slice(0, 2).map((lab) => (
                      <li key={lab.id}><strong className="font-semibold text-[var(--public-ink)]">{lab.testName}:</strong> {lab.conclusion || "Đã có kết quả"}</li>
                    ))}
                  </ul>
                ) : null}
                <Link href={`/tai-khoan/ho-so-suc-khoe/ket-qua/${record.id}`} className={LINK_CLASS}>Xem toàn bộ kết quả</Link>
              </li>
            ))}
          </ul>
        ) : (
          <PatientEmptyState title="Chưa có kết quả khám" description="Kết quả xuất hiện sau khi bác sĩ hoàn tất và bệnh viện công bố hồ sơ." />
        )
      ) : query.data.prescriptions.length ? (
        <ul className={LIST_CLASS}>
          {query.data.prescriptions.map((prescription) => (
            <li key={prescription.id} className="p-4 sm:p-5">
              <p className="text-sm text-[var(--public-muted)]">{formatShortDate(prescription.issuedAt || prescription.createdAt)} · {doctorLabel(prescription.doctor)}</p>
              <h2 className="mt-0.5 text-base font-bold">Đơn thuốc {prescription.prescriptionCode}</h2>
              <ul className="mt-2 space-y-1 text-sm text-[var(--public-text-soft)]">
                {prescription.items.slice(0, 3).map((item) => (
                  <li key={item.id}><strong className="font-semibold text-[var(--public-ink)]">{item.medicineName}</strong> · {item.dosage} · {item.frequency}</li>
                ))}
              </ul>
              <Link href={`/tai-khoan/ho-so-suc-khoe/don-thuoc/${prescription.id}`} className={LINK_CLASS}>Xem chi tiết đơn thuốc</Link>
            </li>
          ))}
        </ul>
      ) : (
        <PatientEmptyState title="Chưa có đơn thuốc" description="Đơn thuốc xuất hiện sau khi bác sĩ phát hành chính thức." />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Stethoscope } from "lucide-react";
import { PatientPageError, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useMedicalRecord } from "@/features/portal/hooks";
import { formatLongDate } from "@/lib/format";

const CARD = "rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5";
const VALUE = "mt-1.5 whitespace-pre-line rounded-lg bg-[var(--public-surface-muted)] p-3 text-sm leading-6";

export default function MedicalRecordDetailPage() {
  const id = String(useParams<{ id: string }>().id || "");
  const query = useMedicalRecord(id);
  if (query.isLoading) return <PatientPageLoading label="Đang tải hồ sơ khám..." />;
  if (query.isError || !query.data) return <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tìm thấy hồ sơ khám."} onRetry={() => query.refetch()} />;

  const record = query.data;
  // Mục không có nội dung thì ẩn, không hiện chữ "Chưa có nội dung".
  const sections = [
    { label: "Triệu chứng", value: record.symptoms },
    { label: "Chẩn đoán", value: record.diagnosis },
    { label: "Hướng điều trị", value: record.treatment },
    { label: "Ghi chú đơn thuốc", value: record.prescription },
  ].filter((item) => item.value?.trim());

  return (
    <div className="space-y-5">
      <Link href="/tai-khoan/ho-so-suc-khoe" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Quay lại hồ sơ sức khỏe
      </Link>

      <header className={`${CARD} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Phiếu khám {record.recordCode}</h1>
          <p className="mt-1 text-sm text-[var(--public-muted)]">
            {record.appointment.patientName ? `Khám cho ${record.appointment.patientName} · ` : ""}công bố {formatLongDate(record.publishedAt || record.createdAt)}
          </p>
        </div>
        {record.resultFile?.available ? (
          <a href={`/api/nguoi-kham/tep/${record.id}`} target="_blank" rel="noreferrer" className="public-button-secondary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold">
            <Download className="h-4 w-4" aria-hidden="true" /> Mở tệp kết quả
          </a>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className={CARD}>
            <h2 className="text-base font-bold">Nội dung chuyên môn</h2>
            {sections.length ? (
              <dl className="mt-3 space-y-4">
                {sections.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold text-[var(--public-muted)]">{item.label}</dt>
                    <dd className={VALUE}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-[var(--public-muted)]">Bác sĩ chưa ghi nội dung chuyên môn cho phiếu khám này.</p>
            )}
          </section>

          {record.labResults.length ? (
            <section className={CARD}>
              <h2 className="text-base font-bold">Kết quả xét nghiệm</h2>
              <ul className="mt-3 space-y-3">
                {record.labResults.map((lab) => (
                  <li key={lab.id} className="rounded-lg border border-[var(--public-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{lab.testName}</h3>
                        <p className="mt-0.5 text-sm text-[var(--public-text-soft)]">{lab.resultValue || "Đã có kết quả"}{lab.unit ? ` ${lab.unit}` : ""}</p>
                        {lab.referenceRange ? <p className="mt-0.5 text-xs text-[var(--public-muted)]">Tham chiếu: {lab.referenceRange}</p> : null}
                      </div>
                      {lab.file?.available ? (
                        <a href={`/api/nguoi-kham/tep/${record.id}/xet-nghiem/${lab.id}`} target="_blank" rel="noreferrer" className="public-button-secondary inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold">
                          <Download className="h-4 w-4" aria-hidden="true" /> Tệp đính kèm
                        </a>
                      ) : null}
                    </div>
                    {lab.conclusion ? <p className="mt-3 rounded-lg bg-[var(--public-primary-soft)] p-3 text-sm text-[var(--public-primary-dark)]">{lab.conclusion}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className={`${CARD} h-fit`}>
          <Stethoscope className="h-6 w-6 text-[var(--public-primary)]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold">Bác sĩ phụ trách</h2>
          <p className="mt-1 font-semibold">{record.doctor.title ? `${record.doctor.title} ` : ""}{record.doctor.user.fullName}</p>
          <p className="text-sm text-[var(--public-muted)]">{record.doctor.department?.name || record.doctor.specialization || "Chuyên khoa"}</p>
          <p className="mt-4 rounded-lg bg-[var(--public-surface-muted)] p-3 text-xs leading-5 text-[var(--public-text-soft)]">Hồ sơ chỉ hiển thị sau khi được cơ sở khám công bố. Không tự chỉnh sửa nội dung chuyên môn.</p>
        </aside>
      </div>
    </div>
  );
}

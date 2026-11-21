"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { PatientPageError, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { usePrescription } from "@/features/portal/hooks";
import { formatLongDate } from "@/lib/format";
import type { PatientPrescription } from "@/lib/patient-portal-types";

const CARD = "rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5";
const CELL = "rounded-lg bg-[var(--public-surface-muted)] p-3 text-sm";

type Medicine = PatientPrescription["items"][number];

// Tình trạng cấp thuốc: đã cấp, tự mua, hết thuốc; chưa xử lý thì không hiện gì.
function Fulfillment({ medicine }: { medicine: Medicine }) {
  if (medicine.fulfillmentStatus === "DISPENSED") return <span className="mt-1.5 inline-flex rounded-full bg-[var(--public-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--public-success)]">Đã cấp tại cơ sở khám</span>;
  if (medicine.fulfillmentStatus === "OUTSIDE") return <span className="mt-1.5 inline-flex rounded-full bg-[var(--public-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--public-text-soft)]">Bạn tự mua tại nhà thuốc</span>;
  if (medicine.fulfillmentStatus === "OUT_OF_STOCK") {
    return <p className="mt-2 rounded-lg bg-[var(--public-warning-soft)] p-2.5 text-xs font-semibold text-[var(--public-warning)]">Cơ sở khám hết thuốc này. Mua tại nhà thuốc bên ngoài theo đơn.{medicine.fulfillmentNote ? ` ${medicine.fulfillmentNote}` : ""}</p>;
  }
  return null;
}

export default function PrescriptionDetailPage() {
  const id = String(useParams<{ id: string }>().id || "");
  const query = usePrescription(id);
  if (query.isLoading) return <PatientPageLoading label="Đang tải đơn thuốc..." />;
  if (query.isError || !query.data) return <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tìm thấy đơn thuốc."} onRetry={() => query.refetch()} />;

  const item = query.data;
  const doctor = `${item.doctor.title ? `${item.doctor.title} ` : ""}${item.doctor.user.fullName}`;
  const meta = [item.appointment?.patientName ? `Đơn thuốc của ${item.appointment.patientName}` : null, formatLongDate(item.issuedAt || item.createdAt), doctor].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <Link href="/tai-khoan/ho-so-suc-khoe" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Quay lại hồ sơ sức khỏe
      </Link>

      <header className={`${CARD} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{item.prescriptionCode}</h1>
          <p className="mt-1 text-sm text-[var(--public-muted)]">{meta}</p>
        </div>
        <span className="rounded-full bg-[var(--public-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--public-primary-dark)]">Đã phát hành</span>
      </header>

      <section className={CARD}>
        <h2 className="text-base font-bold">Thuốc và cách sử dụng</h2>
        <ul className="mt-3 space-y-3">
          {item.items.map((medicine, index) => (
            <li key={medicine.id} className="rounded-lg border border-[var(--public-border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{index + 1}. {medicine.medicineName}</h3>
                {medicine.quantity ? <span className="shrink-0 text-xs font-semibold text-[var(--public-muted)]">{medicine.quantity} {medicine.unit || ""}</span> : null}
              </div>
              <Fulfillment medicine={medicine} />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <span className={CELL}><strong className="block text-xs font-semibold text-[var(--public-muted)]">Liều dùng</strong>{medicine.dosage}</span>
                <span className={CELL}><strong className="block text-xs font-semibold text-[var(--public-muted)]">Tần suất</strong>{medicine.frequency}</span>
                <span className={CELL}><strong className="block text-xs font-semibold text-[var(--public-muted)]">Thời gian</strong>{medicine.duration || "Theo hướng dẫn"}</span>
              </div>
              {medicine.instruction ? (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--public-surface-muted)] p-3 text-sm text-[var(--public-text-soft)]">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {medicine.instruction}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {item.note ? (
          <div className="mt-4 rounded-lg bg-[var(--public-primary-soft)] p-4 text-sm leading-6 text-[var(--public-primary-dark)]">
            <strong className="block">Lưu ý của bác sĩ</strong>
            {item.note}
          </div>
        ) : null}
      </section>
    </div>
  );
}

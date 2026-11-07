"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, Pill, Stethoscope } from "lucide-react";
import { PatientPageError, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { patientPortalRequest } from "@/lib/patient-portal-api";
import type { PatientPrescription } from "@/lib/patient-portal-types";

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(value)) : "Chưa cập nhật";

export default function PrescriptionDetailPage() {
  const id = String(useParams<{ id: string }>().id || "");
  const query = useQuery({ queryKey: ["patient-prescription", id], queryFn: async () => (await patientPortalRequest<PatientPrescription>(`/don-thuoc/${id}`)).data, enabled: Boolean(id), staleTime: 60_000 });
  if (query.isLoading) return <PatientPageLoading label="Đang tải đơn thuốc..." />;
  if (query.isError || !query.data) return <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tìm thấy đơn thuốc."} onRetry={() => query.refetch()} />;
  const item = query.data;
  return <div className="space-y-5"><Link href="/tai-khoan/ho-so-suc-khoe" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"><ArrowLeft className="h-4 w-4" /> Quay lại hồ sơ sức khỏe</Link><section className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Đơn thuốc đã phát hành</span><h1 className="mt-3 text-2xl font-bold">{item.prescriptionCode}</h1><p className="mt-2 flex items-center gap-2 text-sm text-[var(--public-muted)]"><CalendarDays className="h-4 w-4" /> {formatDate(item.issuedAt || item.createdAt)}</p></div><div className="rounded-2xl bg-[var(--public-surface-muted)] p-4 text-sm"><Stethoscope className="mb-2 h-5 w-5 text-[var(--public-primary)]" /><strong>{item.doctor.title ? `${item.doctor.title} ` : ""}{item.doctor.user.fullName}</strong></div></div></section>
    <section className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Pill className="h-5 w-5 text-violet-600" /><h2 className="text-xl font-bold">Thuốc và cách sử dụng</h2></div><div className="mt-5 space-y-3">{item.items.map((medicine, index) => <article key={medicine.id} className="grid gap-4 rounded-2xl border border-[var(--public-border)] p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-800">{index + 1}</span><div><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold">{medicine.medicineName}</h3>{medicine.quantity ? <span className="text-xs font-semibold text-[var(--public-muted)]">{medicine.quantity} {medicine.unit || ""}</span> : null}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span className="rounded-xl bg-[var(--public-surface-muted)] p-3"><strong className="block text-xs text-[var(--public-muted)]">Liều dùng</strong>{medicine.dosage}</span><span className="rounded-xl bg-[var(--public-surface-muted)] p-3"><strong className="block text-xs text-[var(--public-muted)]">Tần suất</strong>{medicine.frequency}</span><span className="rounded-xl bg-[var(--public-surface-muted)] p-3"><strong className="block text-xs text-[var(--public-muted)]">Thời gian</strong>{medicine.duration || "Theo hướng dẫn"}</span></div>{medicine.instruction ? <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />{medicine.instruction}</p> : null}</div></article>)}</div>{item.note ? <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong className="block">Lưu ý của bác sĩ</strong>{item.note}</div> : null}</section>
  </div>;
}


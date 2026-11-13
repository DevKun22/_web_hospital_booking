"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, CreditCard, MapPin, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { AppointmentReviewCard } from "@/components/patient/appointment-review-card";
import { PatientPageError, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { patientPortalRequest } from "@/lib/patient-portal-api";
import type { PatientAppointment } from "@/lib/patient-portal-types";

import { formatWeekdayDate, formatMoney } from "@/lib/format";

import { APPOINTMENT_PROGRESS, APPOINTMENT_STATUS_DETAIL } from "@/lib/patient-status";
export default function AppointmentDetailPage() {
  const id = String(useParams<{ id: string }>().id || "");
  const query = useQuery({ queryKey: ["patient-appointment", id], queryFn: async () => (await patientPortalRequest<PatientAppointment>(`/lich-hen/${id}`)).data, enabled: Boolean(id), staleTime: 15_000 });
  if (query.isLoading) return <PatientPageLoading label="Đang tải chi tiết lịch hẹn..." />;
  if (query.isError || !query.data) return <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tìm thấy lịch hẹn."} onRetry={() => query.refetch()} />;
  const item = query.data;
  const currentIndex = APPOINTMENT_PROGRESS.indexOf(item.status === "RESCHEDULED" ? "CONFIRMED" : item.status);
  const isCancelled = item.status.startsWith("CANCELLED") || item.status === "NO_SHOW";
  return <div className="space-y-5">
    <Link href="/tai-khoan/lich-hen" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"><ArrowLeft className="h-4 w-4" /> Quay lại lịch hẹn</Link>
    <section className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--public-primary)]">Chi tiết lịch hẹn</p><h1 className="mt-2 text-2xl font-bold">#{item.bookingCode}</h1><p className="mt-2 text-sm text-[var(--public-muted)]">Đặt cho {item.patientName}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${isCancelled ? "bg-red-100 text-red-700" : item.status === "COMPLETED" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>{APPOINTMENT_STATUS_DETAIL[item.status] || item.status}</span></div>
      {!isCancelled ? <ol className="mt-7 grid gap-2 sm:grid-cols-5" aria-label="Tiến trình lịch hẹn">{APPOINTMENT_PROGRESS.map((status, index) => <li key={status} className={`rounded-xl border p-3 text-xs font-semibold ${index <= currentIndex ? "border-blue-200 bg-blue-50 text-blue-800" : "border-[var(--public-border)] text-[var(--public-muted)]"}`}><CheckCircle2 className={`mb-2 h-4 w-4 ${index <= currentIndex ? "text-[var(--public-primary)]" : "text-slate-300"}`} />{APPOINTMENT_STATUS_DETAIL[status]}</li>)}</ol> : <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong className="block">Lịch hẹn không còn hiệu lực</strong><span className="mt-1 block">{item.cancelledReason || APPOINTMENT_STATUS_DETAIL[item.status]}</span></div>}
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]"><section className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">Thông tin tiếp nhận</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{[
      { icon: CalendarDays, label: "Ngày khám", value: formatWeekdayDate(item.appointmentDate) },
      { icon: Clock3, label: "Khung giờ", value: `${item.startTime}–${item.endTime}` },
      { icon: Stethoscope, label: "Bác sĩ", value: `${item.doctor.title ? `${item.doctor.title} ` : ""}${item.doctor.user.fullName}` },
      { icon: MapPin, label: "Chuyên khoa", value: item.department.name },
      { icon: UserRound, label: "Người khám", value: item.patientName },
      { icon: ShieldCheck, label: "BHYT", value: item.hasBHYT ? "Có áp dụng" : "Không áp dụng" },
    ].map((row) => <div key={row.label} className="flex items-start gap-3 rounded-2xl bg-[var(--public-surface-muted)] p-4"><row.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--public-primary)]" /><div><span className="text-xs text-[var(--public-muted)]">{row.label}</span><strong className="mt-1 block text-sm">{row.value}</strong></div></div>)}</div>{item.package ? <div className="mt-4 rounded-2xl border border-[var(--public-border)] p-4"><span className="text-xs text-[var(--public-muted)]">Gói khám đã chọn</span><strong className="mt-1 block">{item.package.name}</strong></div> : null}{item.reason ? <div className="mt-4"><h3 className="text-sm font-bold">Lý do khám</h3><p className="mt-2 rounded-2xl bg-[var(--public-surface-muted)] p-4 text-sm leading-6 text-[var(--public-text-soft)]">{item.reason}</p></div> : null}</section>
      <aside className="h-fit rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-[var(--public-primary)]" /><h2 className="text-lg font-bold">Chi phí dự kiến</h2></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-[var(--public-muted)]">Phí khám/dịch vụ</dt><dd className="font-semibold tabular-nums">{formatMoney(item.estimatedPrice)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[var(--public-muted)]">Phí dịch vụ</dt><dd className="font-semibold tabular-nums">{formatMoney(item.serviceFee)}</dd></div><div className="flex justify-between gap-3 text-emerald-700"><dt>Giảm trừ BHYT</dt><dd className="font-semibold tabular-nums">−{formatMoney(item.bhytDiscount)}</dd></div><div className="flex justify-between gap-3 border-t border-[var(--public-divider)] pt-4 text-base"><dt className="font-bold">Tạm tính</dt><dd className="font-bold tabular-nums text-[var(--public-primary-dark)]">{formatMoney(item.finalAmount)}</dd></div></dl><p className="mt-4 text-xs leading-5 text-[var(--public-muted)]">Chi phí cuối cùng được xác nhận trên hóa đơn sau khi hoàn tất dịch vụ.</p></aside>
    </div>
    {item.status === "COMPLETED" ? <AppointmentReviewCard appointmentId={item.id} /> : null}
  </div>;
}

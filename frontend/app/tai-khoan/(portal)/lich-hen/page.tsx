"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, Clock3, Loader2, MapPin, Stethoscope, X } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { patientPortalRequest } from "@/lib/patient-portal-api";
import type { PatientAppointment } from "@/lib/patient-portal-types";

type Filter = "upcoming" | "history" | "cancelled";
const cancelled = new Set(["CANCELLED_BY_PATIENT", "CANCELLED_BY_DOCTOR", "CANCELLED_BY_ADMIN", "NO_SHOW"]);
const active = new Set(["PENDING_OTP", "PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "RESCHEDULED"]);
const canCancel = new Set(["PENDING_OTP", "PENDING_CONFIRM", "CONFIRMED", "RESCHEDULED"]);
const statusMap: Record<string, { label: string; style: string }> = {
  PENDING_OTP: { label: "Chờ xác thực OTP", style: "bg-amber-100 text-amber-800" },
  PENDING_CONFIRM: { label: "Chờ xác nhận", style: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Đã xác nhận", style: "bg-emerald-100 text-emerald-800" },
  CHECKED_IN: { label: "Đã tiếp nhận", style: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "Đang khám", style: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Đã hoàn tất", style: "bg-slate-200 text-slate-700" },
  RESCHEDULED: { label: "Đã đổi lịch", style: "bg-violet-100 text-violet-800" },
  CANCELLED_BY_PATIENT: { label: "Bạn đã hủy", style: "bg-red-100 text-red-700" },
  CANCELLED_BY_DOCTOR: { label: "Bác sĩ đã hủy", style: "bg-red-100 text-red-700" },
  CANCELLED_BY_ADMIN: { label: "Bệnh viện đã hủy", style: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "Không đến khám", style: "bg-slate-200 text-slate-700" },
};
const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
const appointmentTime = (item: PatientAppointment) => new Date(`${item.appointmentDate.slice(0, 10)}T${item.startTime || "00:00"}`);

export default function PatientAppointmentsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["patient-appointments"], queryFn: async () => (await patientPortalRequest<PatientAppointment[]>("/lich-hen?page=1&limit=50")).data, staleTime: 20_000 });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => patientPortalRequest(`/lich-hen/${id}/huy`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }),
    onSuccess: async () => { setCancelId(null); setReason(""); await queryClient.invalidateQueries({ queryKey: ["patient-appointments"] }); await queryClient.invalidateQueries({ queryKey: ["patient-portal-overview"] }); },
  });

  const items = useMemo(() => {
    const now = new Date();
    return (query.data || []).filter((item) => {
      if (filter === "cancelled") return cancelled.has(item.status);
      if (filter === "upcoming") return active.has(item.status) && appointmentTime(item) >= now;
      return item.status === "COMPLETED" || (active.has(item.status) && appointmentTime(item) < now);
    }).sort((a, b) => filter === "upcoming" ? appointmentTime(a).getTime() - appointmentTime(b).getTime() : appointmentTime(b).getTime() - appointmentTime(a).getTime());
  }, [filter, query.data]);

  return <div className="space-y-6">
    <PatientPageHeader eyebrow="Quản lý lịch hẹn" title="Lịch khám của tôi" description="Theo dõi trạng thái, thời gian và thông tin tiếp nhận. Dữ liệu đồng bộ với ứng dụng Mobile." action={<Link href="/dat-lich" className="public-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold"><CalendarPlus className="h-4 w-4" aria-hidden="true" /> Đặt lịch mới</Link>} />
    <div role="tablist" aria-label="Lọc lịch hẹn" className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--public-border)] bg-white p-2 shadow-sm">{([{ key: "upcoming", label: "Sắp tới" }, { key: "history", label: "Đã khám" }, { key: "cancelled", label: "Đã hủy" }] as const).map((item) => <button key={item.key} role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${filter === item.key ? "bg-[var(--public-primary)] text-white" : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}>{item.label}</button>)}</div>
    {query.isLoading ? <PatientPageLoading label="Đang tải lịch hẹn..." /> : query.isError ? <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được lịch hẹn."} onRetry={() => query.refetch()} /> : items.length === 0 ? <PatientEmptyState title={filter === "upcoming" ? "Chưa có lịch khám sắp tới" : "Chưa có dữ liệu trong nhóm này"} description="Các lịch hẹn sẽ tự động xuất hiện đúng nhóm khi trạng thái được cập nhật." action={filter === "upcoming" ? <Link href="/dat-lich" className="public-button-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold">Đặt lịch khám</Link> : undefined} /> : <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => {
      const status = statusMap[item.status] || { label: item.status, style: "bg-slate-100 text-slate-700" };
      return <article key={item.id} className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${status.style}`}>{status.label}</span><p className="mt-2 text-xs font-semibold text-[var(--public-muted)]">Mã lịch #{item.bookingCode}</p></div><strong className="text-sm text-[var(--public-primary-dark)]">{item.patientName}</strong></div>
        <div className="mt-4 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]"><Stethoscope className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-bold">{item.doctor.title ? `${item.doctor.title} ` : ""}{item.doctor.user.fullName}</h2><p className="mt-1 text-sm text-[var(--public-text-soft)]">{item.department.name}{item.package ? ` · ${item.package.name}` : ""}</p></div></div>
        <div className="mt-4 grid gap-2 rounded-2xl bg-[var(--public-surface-muted)] p-4 text-sm sm:grid-cols-2"><span className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" /><span><strong className="block">{item.startTime}–{item.endTime}</strong>{formatDate(item.appointmentDate)}</span></span><span className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" /><span><strong className="block">Nơi tiếp nhận</strong>{item.department.name}</span></span></div>
        {cancelId === item.id ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4"><label className="text-sm font-bold text-red-800">Lý do hủy lịch<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-red-200 bg-white p-3 text-sm text-[var(--public-ink)] outline-none focus:border-red-500" placeholder="Nhập lý do cụ thể (tối thiểu 3 ký tự)" /></label>{cancelMutation.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{cancelMutation.error instanceof Error ? cancelMutation.error.message : "Không thể hủy lịch."}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={reason.trim().length < 3 || cancelMutation.isPending} onClick={() => cancelMutation.mutate(item.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">{cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Xác nhận hủy</button><button type="button" onClick={() => { setCancelId(null); setReason(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[var(--public-text-soft)]"><X className="h-4 w-4" /> Giữ lịch</button></div></div> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Link href={`/tai-khoan/lich-hen/${item.id}`} className="public-button-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold">Xem chi tiết</Link>{canCancel.has(item.status) && cancelId !== item.id ? <button type="button" onClick={() => setCancelId(item.id)} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-red-700 hover:bg-red-50">Hủy lịch</button> : null}</div>
      </article>;
    })}</div>}
  </div>;
}


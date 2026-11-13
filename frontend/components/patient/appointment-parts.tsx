import { appointmentStatusDisplay } from "@/lib/patient-status";
import type { PatientAppointment } from "@/lib/patient-portal-types";

const MONTH = ["", "Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];

// Trạng thái lịch hẹn: màu nền nhạt, chữ đậm cùng họ màu; nhãn chữ luôn có, không chỉ dựa vào màu.
export function StatusChip({ status }: { status: string }) {
  const { label, style } = appointmentStatusDisplay(status);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

// Khối ngày bên trái hàng lịch hẹn: tháng, ngày to, nhìn lướt biết ngay lịch vào lúc nào.
export function DateBlock({ date }: { date: string }) {
  const [, month, day] = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)?.slice(1).map(Number) ?? [0, 0, 0];
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] text-center" aria-hidden="true">
      <span className="text-[11px] font-semibold uppercase leading-3 text-[var(--public-muted)]">{MONTH[month] || ""}</span>
      <span className="text-xl font-bold leading-6 tabular-nums">{day || ""}</span>
    </div>
  );
}

export const doctorLine = (item: PatientAppointment) =>
  [item.doctor.title, item.doctor.user.fullName].filter(Boolean).join(" ");

export const timeRange = (item: PatientAppointment) => `${item.startTime}–${item.endTime}`;

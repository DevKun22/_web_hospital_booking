"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { useAuth } from "@/lib/auth";
import {
  type DoctorDashboardData,
  useDashboardStatistics,
  useDoctorDashboardOverview,
} from "@/lib/dashboard-overview-query";
import { formatVietnamDate, formatVietnamDateTime, getVietnamDateInput } from "@/lib/date";
import type {
  DashboardAppointmentStatistics,
  DashboardDepartmentStatistics,
  DashboardDoctorStatistics,
  DashboardRevenueStatistics,
  DashboardStatisticsOverview,
  PaymentMethod,
} from "@/lib/types";

const statusLabel: Record<string, string> = {
  PENDING_OTP: "Chờ OTP",
  PENDING_CONFIRM: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn tất",
  RESCHEDULED: "Đổi lịch",
  CANCELLED_BY_PATIENT: "BN hủy",
  CANCELLED_BY_DOCTOR: "BS hủy",
  CANCELLED_BY_ADMIN: "Admin hủy",
  NO_SHOW: "No-show",
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  REFUNDED: "Hoàn tiền",
};

const paymentLabel: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  MOMO: "MoMo",
  VNPAY: "VNPay",
  OTHER: "Khác",
};

const searchTypeLabel: Record<string, string> = {
  all: "Tất cả",
  department: "Chuyên khoa",
  doctor: "Bác sĩ",
  package: "Gói khám",
  faq: "Câu hỏi",
  chatbot_faq: "Trợ lý",
};

const searchSourceLabel: Record<string, string> = {
  elasticsearch: "Elasticsearch",
  postgres: "PostgreSQL",
  empty: "Rỗng",
  unknown: "Không rõ",
};

const slotLabel: Record<string, string> = {
  AVAILABLE: "Trống",
  BOOKED: "Đã đặt",
  LOCKED: "Khóa",
  CANCELLED: "Hủy",
};

const pieColors = ["#0d4f8b", "#2a7f62", "#b7791f", "#7c3aed", "#b3261e", "#42526b"];

const toDateInput = (date: Date) => getVietnamDateInput(date);

const getMonthRange = () => {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const formatDate = (value?: string | null) => value ? formatVietnamDate(value) : "-";

const formatDateTime = (value?: string | null) =>
  value ? formatVietnamDateTime(value) : "-";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value || 0);

const compactCurrency = (value: number) => {
  if (!value) return "0";
  if (Math.abs(value) >= 1_000_000_000) return `${Math.round(value / 1_000_000_000)} tỷ`;
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)} tr`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
};

const toTooltipNumber = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const number = Number(rawValue);
  return Number.isFinite(number) ? number : 0;
};

const currencyTooltip = (value: unknown) => formatCurrency(toTooltipNumber(value));
const numberTooltip = (value: unknown) => formatNumber(toTooltipNumber(value));
const hasChartValue = <T,>(items: T[], keys: (keyof T)[]) =>
  items.some((item) => keys.some((key) => Number(item[key]) > 0));

type MetricCardProps = {
  title: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
  caption?: string;
};

const metricTone = {
  blue: "border-[#cfe4fa] bg-[#f3f8ff] text-[#0d4f8b]",
  green: "border-[#c7ead0] bg-[#f0fff4] text-[#1f7a3a]",
  amber: "border-[#f4d7a1] bg-[#fff8eb] text-[#946200]",
  red: "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]",
  slate: "border-[#dce3ee] bg-white text-[#172033]",
};

function MetricCard({ title, value, tone = "slate", caption }: MetricCardProps) {
  return (
    <div className={`rounded-md border p-4 ${metricTone[tone]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {caption ? <p className="mt-1 text-xs opacity-70">{caption}</p> : null}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-md border border-dashed border-[#dce3ee] bg-[#f8fafc] px-4 text-center text-sm text-[#667892]">
      {message}
    </div>
  );
}

function ActionRow({
  title,
  value,
  href,
  tone = "amber",
}: {
  title: string;
  value: string;
  href: string;
  tone?: "amber" | "red" | "blue";
}) {
  const toneClass = {
    amber: "bg-[#fff8eb] text-[#946200]",
    red: "bg-[#fff3f2] text-[#b3261e]",
    blue: "bg-[#f3f8ff] text-[#0d4f8b]",
  }[tone];

  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-md border border-[#e5ebf3] p-3 hover:border-[#0d4f8b]">
      <div>
        <p className="text-sm font-semibold text-[#172033]">{title}</p>
        <p className="mt-1 text-xs text-[#667892]">Mở màn hình xử lý liên quan</p>
      </div>
      <span className={`rounded-md px-2 py-1 text-sm font-semibold ${toneClass}`}>{value}</span>
    </Link>
  );
}

function SearchAnalyticsList({
  title,
  items,
  empty,
  tone = "blue",
}: {
  title: string;
  items: { label: string; value: string }[];
  empty: string;
  tone?: "blue" | "amber";
}) {
  const badgeClass = tone === "amber"
    ? "bg-[#fff8eb] text-[#946200]"
    : "bg-[#e7f0fb] text-[#0d4f8b]";

  return (
    <div className="rounded-md border border-[#eef2f7] bg-[#f8fafc] p-4">
      <h4 className="text-sm font-semibold text-[#172033]">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-[#42526b]">{item.label}</span>
            <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${badgeClass}`}>{item.value}</span>
          </div>
        )) : (
          <p className="rounded-md border border-dashed border-[#dce3ee] bg-white px-3 py-4 text-center text-xs text-[#667892]">
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const canViewStats = user?.role === "ADMIN" || user?.role === "STAFF";
  const isDoctorDashboard = user?.role === "DOCTOR";
  const monthRange = useMemo(() => getMonthRange(), []);
  const todayDate = useMemo(() => toDateInput(new Date()), []);
  const [from, setFrom] = useState(monthRange.from);
  const [to, setTo] = useState(monthRange.to);
  const [appliedRange, setAppliedRange] = useState(monthRange);
  const [overview, setOverview] = useState<DashboardStatisticsOverview | null>(null);
  const [appointments, setAppointments] = useState<DashboardAppointmentStatistics | null>(null);
  const [revenue, setRevenue] = useState<DashboardRevenueStatistics | null>(null);
  const [doctors, setDoctors] = useState<DashboardDoctorStatistics | null>(null);
  const [departments, setDepartments] = useState<DashboardDepartmentStatistics | null>(null);
  const [error, setError] = useState("");
  const [doctorDashboard, setDoctorDashboard] = useState<DoctorDashboardData | null>(null);
  const [doctorError, setDoctorError] = useState("");

  const statisticsQuery = useMemo(
    () => ({
      from: appliedRange.from,
      to: appliedRange.to,
    }),
    [appliedRange],
  );
  const statisticsResult = useDashboardStatistics(statisticsQuery, canViewStats);
  const doctorDashboardResult = useDoctorDashboardOverview(todayDate, isDoctorDashboard);
  const loading = statisticsResult.isLoading;
  const doctorLoading = doctorDashboardResult.isLoading;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!statisticsResult.data) return;
      setOverview(statisticsResult.data.overview);
      setAppointments(statisticsResult.data.appointments);
      setRevenue(statisticsResult.data.revenue);
      setDoctors(statisticsResult.data.doctors);
      setDepartments(statisticsResult.data.departments);
      setError("");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [statisticsResult.data]);

  useEffect(() => {
    if (!statisticsResult.error) return;
    const timeoutId = window.setTimeout(() => {
      setError(statisticsResult.error instanceof Error ? statisticsResult.error.message : "Không tải được thống kê tổng quan");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [statisticsResult.error]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!doctorDashboardResult.data) return;
      setDoctorDashboard(doctorDashboardResult.data);
      setDoctorError("");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [doctorDashboardResult.data]);

  useEffect(() => {
    if (!doctorDashboardResult.error) return;
    const timeoutId = window.setTimeout(() => {
      setDoctorError(doctorDashboardResult.error instanceof Error ? doctorDashboardResult.error.message : "Không tải được tổng quan bác sĩ");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [doctorDashboardResult.error]);
  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedRange({ from, to });
  };

  const resetMonth = () => {
    const nextRange = getMonthRange();
    setFrom(nextRange.from);
    setTo(nextRange.to);
    setAppliedRange(nextRange);
  };

  const appointmentDaily = appointments?.daily.map((item) => ({
    ...item,
    label: formatDate(item.date),
  })) || [];

  const revenueDaily = revenue?.daily.map((item) => ({
    ...item,
    label: formatDate(item.date),
  })) || [];

  const appointmentStatusData = appointments?.byStatus
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, label: statusLabel[item.value] || item.value })) || [];

  const invoiceStatusData = revenue?.byStatus
    .filter((item) => item.count > 0 || item.amount > 0)
    .map((item) => ({ ...item, label: statusLabel[item.status] || item.status })) || [];

  const paymentMethodData = revenue?.byPaymentMethod
    .filter((item) => item.count > 0 || item.amount > 0)
    .map((item) => ({ ...item, label: paymentLabel[item.paymentMethod] || item.paymentMethod })) || [];

  const hasAppointmentTrend = hasChartValue(appointmentDaily, ["total", "completed", "cancelled"]);
  const hasRevenueTrend = hasChartValue(revenueDaily, ["collectedAmount", "refundedAmount", "netAmount"]);
  const hasAppointmentStatus = appointmentStatusData.length > 0;
  const hasPaymentMethod = paymentMethodData.length > 0;

  const doctorTasks = [
    ...(doctorDashboard?.inProgressAppointments || []).slice(0, 3).map((item) => ({
      id: `progress-${item.id}`,
      title: `${item.patientName} đang khám`,
      caption: `${item.bookingCode} · ${item.startTime} - ${item.endTime}`,
      href: "/dashboard/medical-records",
      tone: "blue" as const,
    })),
    ...(doctorDashboard?.checkedInAppointments || []).slice(0, 3).map((item) => ({
      id: `checked-${item.id}`,
      title: `${item.patientName} đã check-in`,
      caption: `${item.bookingCode} · ${item.startTime} - ${item.endTime}`,
      href: "/dashboard/appointments",
      tone: "amber" as const,
    })),
    ...(doctorDashboard?.draftRecords || []).slice(0, 2).map((item) => ({
      id: `record-${item.id}`,
      title: `Hồ sơ ${item.recordCode} còn nháp`,
      caption: `${item.patient.fullName} · ${formatDate(item.appointment.appointmentDate)}`,
      href: "/dashboard/medical-records",
      tone: "red" as const,
    })),
    ...(doctorDashboard?.draftPrescriptions || []).slice(0, 2).map((item) => ({
      id: `prescription-${item.id}`,
      title: `Đơn thuốc ${item.prescriptionCode} còn nháp`,
      caption: `${item.patient.fullName} · ${item.items.length} thuốc`,
      href: "/dashboard/prescriptions",
      tone: "amber" as const,
    })),
  ].slice(0, 6);

  const slotSummary = (doctorDashboard?.todaySlots || []).reduce<Record<string, number>>((summary, slot) => {
    summary[slot.status] = (summary[slot.status] || 0) + 1;
    return summary;
  }, {});

  const completedTodayCount = (doctorDashboard?.todayAppointments || []).filter((item) => item.status === "COMPLETED").length;
  const waitingTodayCount = (doctorDashboard?.todayAppointments || []).filter((item) => ["CONFIRMED", "CHECKED_IN"].includes(item.status)).length;

  if (isDoctorDashboard) {
    return (
      <div className="space-y-6">
        <section className="rounded-md border border-[#dce3ee] bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[#55708f]">Xin chào, {user?.fullName}</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#172033]">Tổng quan bác sĩ</h2>
              <p className="mt-2 text-sm text-[#667892]">
                Dữ liệu được lấy từ các API đã giới hạn theo tài khoản bác sĩ, ngày {formatDate(todayDate)}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void doctorDashboardResult.refetch()}
                className="rounded-md border border-[#cfd8e6] px-4 py-2 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]"
              >
                Làm mới
              </button>
              <Link href="/dashboard/appointments" className="rounded-md bg-[#0d4f8b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083d6d]">
                Mở lịch hẹn
              </Link>
            </div>
          </div>
        </section>

        {doctorError ? (
          <section className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4 text-sm text-[#b3261e]">{doctorError}</section>
        ) : null}

        {doctorLoading ? (
          <section className="rounded-md border border-[#dce3ee] bg-white p-8 text-center text-sm text-[#667892]">Đang tải tổng quan bác sĩ...</section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Lịch hôm nay" value={formatNumber(doctorDashboard?.todayAppointments.length || 0)} tone="blue" />
          <MetricCard title="Đang chờ khám" value={formatNumber(waitingTodayCount)} tone="amber" />
          <MetricCard title="Đang khám" value={formatNumber(doctorDashboard?.inProgressAppointments.length || 0)} tone="red" />
          <MetricCard title="Đã hoàn tất" value={formatNumber(completedTodayCount)} tone="green" />
          <MetricCard title="Hồ sơ / đơn nháp" value={`${formatNumber(doctorDashboard?.draftRecords.length || 0)} / ${formatNumber(doctorDashboard?.draftPrescriptions.length || 0)}`} tone="slate" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-[#dce3ee] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Việc cần xử lý</h3>
                <p className="mt-1 text-sm text-[#667892]">Ưu tiên ca đang khám, bệnh nhân đã check-in và hồ sơ còn nháp.</p>
              </div>
              <Link href="/dashboard/medical-records" className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Mở hồ sơ</Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {doctorTasks.length ? doctorTasks.map((task) => {
                const toneClass = {
                  amber: "border-[#f4d7a1] bg-[#fff8eb] text-[#946200]",
                  red: "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]",
                  blue: "border-[#cfe4fa] bg-[#f3f8ff] text-[#0d4f8b]",
                }[task.tone];

                return (
                  <Link key={task.id} href={task.href} className={`rounded-md border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}>
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs opacity-75">{task.caption}</p>
                  </Link>
                );
              }) : (
                <p className="rounded-md border border-dashed border-[#dce3ee] bg-[#f8fafc] p-6 text-center text-sm text-[#667892] md:col-span-2">
                  Hiện chưa có việc ưu tiên cần xử lý.
                </p>
              )}
            </div>
          </div>

          <aside className="rounded-md border border-[#dce3ee] bg-white p-5">
            <h3 className="font-semibold">Slot hôm nay</h3>
            <p className="mt-1 text-sm text-[#667892]">Theo dõi nhanh slot trống, đã đặt và bị khóa.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {["AVAILABLE", "BOOKED", "LOCKED", "CANCELLED"].map((status) => (
                <div key={status} className="rounded-md bg-[#f8fafc] p-3">
                  <p className="text-[#667892]">{slotLabel[status] || status}</p>
                  <p className="mt-1 text-lg font-semibold text-[#172033]">{formatNumber(slotSummary[status] || 0)}</p>
                </div>
              ))}
            </div>
            <Link href="/dashboard/schedules" className="mt-4 block rounded-md border border-[#cfd8e6] px-3 py-2 text-center text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">
              Xem lịch làm việc
            </Link>
          </aside>
        </section>

        <section className="rounded-md border border-[#dce3ee] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Lịch hẹn hôm nay</h3>
              <p className="mt-1 text-sm text-[#667892]">Danh sách bệnh nhân trong ngày để bác sĩ bắt đầu hoặc tiếp tục quy trình khám.</p>
            </div>
            <Link href="/dashboard/appointments" className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Xem tất cả</Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] py-3 font-semibold">Bệnh nhân</th>
                  <th className="border-b border-[#e5ebf3] py-3 font-semibold">Thời gian</th>
                  <th className="border-b border-[#e5ebf3] py-3 font-semibold">Lý do khám</th>
                  <th className="border-b border-[#e5ebf3] py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {doctorDashboard?.todayAppointments.length ? doctorDashboard.todayAppointments.map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-[#eef2f7] py-3">
                      <p className="font-semibold">{item.patientName}</p>
                      <p className="mt-1 text-xs text-[#667892]">{item.patientPhone} · {item.bookingCode}</p>
                    </td>
                    <td className="border-b border-[#eef2f7] py-3">{item.startTime} - {item.endTime}</td>
                    <td className="border-b border-[#eef2f7] py-3">{item.reason || "Khám bác sĩ"}</td>
                    <td className="border-b border-[#eef2f7] py-3">
                      <span className="rounded-md bg-[#f1f5f9] px-2 py-1 text-xs font-semibold text-[#42526b]">{statusLabel[item.status] || item.status}</span>
                    </td>
                    <td className="border-b border-[#eef2f7] py-3">
                      <div className="flex justify-end gap-2">
                        <Link href="/dashboard/appointments" className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Lịch hẹn</Link>
                        <Link href="/dashboard/medical-records" className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b]">Hồ sơ</Link>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#667892]">Hôm nay chưa có lịch hẹn.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (!canViewStats) {
    return (
      <div className="space-y-6">
        <section className="rounded-md border border-[#dce3ee] bg-white p-6">
          <p className="text-sm font-medium text-[#55708f]">Xin chào, {user?.fullName}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#172033]">Tổng quan dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667892]">
            Thống kê tổng quan dành cho ADMIN hoặc STAFF. Tài khoản bác sĩ có thể tiếp tục xử lý lịch hẹn, hồ sơ khám và đơn thuốc.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/dashboard/appointments" className="rounded-md border border-[#dce3ee] bg-white p-5 hover:border-[#0d4f8b]"><h3 className="font-semibold">Lịch hẹn</h3><p className="mt-2 text-sm text-[#667892]">Theo dõi và xử lý quy trình khám.</p></Link>
          <Link href="/dashboard/medical-records" className="rounded-md border border-[#dce3ee] bg-white p-5 hover:border-[#0d4f8b]"><h3 className="font-semibold">Hồ sơ khám</h3><p className="mt-2 text-sm text-[#667892]">Cập nhật chẩn đoán và kết quả.</p></Link>
          <Link href="/dashboard/prescriptions" className="rounded-md border border-[#dce3ee] bg-white p-5 hover:border-[#0d4f8b]"><h3 className="font-semibold">Đơn thuốc</h3><p className="mt-2 text-sm text-[#667892]">Lập và phát hành đơn thuốc.</p></Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#dce3ee] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[#55708f]">Xin chào, {user?.fullName}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#172033]">Tổng quan vận hành</h2>
            <p className="mt-2 text-sm text-[#667892]">
              Dữ liệu từ API thống kê theo khoảng {formatDate(appliedRange.from)} - {formatDate(appliedRange.to)}.
            </p>
          </div>
          <form onSubmit={applyFilter} className="grid gap-2 sm:grid-cols-[150px_150px_auto_auto]">
            <label className="block">
              <span className="text-xs font-medium text-[#667892]">Từ ngày</span>
              <VietnamDateInput value={from} onChange={setFrom} ariaLabel="Từ ngày thống kê" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#667892]">Đến ngày</span>
              <VietnamDateInput value={to} onChange={setTo} ariaLabel="Đến ngày thống kê" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
            </label>
            <button className="self-end rounded-md bg-[#0d4f8b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083d6d]">Áp dụng</button>
            <button type="button" onClick={resetMonth} className="self-end rounded-md border border-[#cfd8e6] px-4 py-2 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]">Tháng này</button>
          </form>
        </div>
      </section>

      {error ? (
        <section className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4 text-sm text-[#b3261e]">{error}</section>
      ) : null}

      {loading ? (
        <section className="rounded-md border border-[#dce3ee] bg-white p-8 text-center text-sm text-[#667892]">Đang tải thống kê...</section>
      ) : null}

      {overview ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#667892]">Vận hành</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard title="Tổng lịch hẹn" value={formatNumber(overview.metrics.totalAppointments)} tone="blue" />
              <MetricCard title="Chờ xác nhận" value={formatNumber(overview.metrics.pendingConfirmAppointments)} tone="amber" />
              <MetricCard title="Lịch hôm nay" value={formatNumber(overview.metrics.todayAppointments)} tone="slate" />
              <MetricCard title="Đã hoàn tất" value={formatNumber(overview.metrics.completedAppointments)} tone="green" />
              <MetricCard title="Cần tạo hóa đơn" value={formatNumber(overview.metrics.completedWithoutInvoiceAppointments)} tone="amber" />
              <MetricCard title="Hủy / no-show" value={formatNumber(overview.metrics.cancelledAppointments)} tone="red" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#667892]">Tài chính và tăng trưởng</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard title="Bệnh nhân mới" value={formatNumber(overview.metrics.newPatients)} tone="blue" />
              <MetricCard title="Tư vấn trong kỳ" value={formatNumber(overview.metrics.consultationRequests)} tone="blue" />
              <MetricCard title="Tư vấn cần xử lý" value={formatNumber(overview.metrics.pendingConsultationRequests)} tone="amber" />
              <MetricCard title="Hóa đơn chưa TT" value={formatNumber(overview.metrics.unpaidInvoices)} tone="amber" />
              <MetricCard title="Đã thu" value={formatCurrency(overview.metrics.collectedAmount)} tone="green" />
              <MetricCard title="Doanh thu thuần" value={formatCurrency(overview.metrics.netAmount)} tone="green" caption={`Hoàn tiền ${formatCurrency(overview.metrics.refundedAmount)}`} />
            </div>
          </div>
        </section>
      ) : null}

      {overview ? (
        <section className="rounded-md border border-[#dce3ee] bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold">Hành vi tìm kiếm</h3>
              <p className="mt-1 text-sm text-[#667892]">
                Theo dõi từ khóa người dùng tìm trên website để bổ sung nội dung, FAQ và dữ liệu chatbot.
              </p>
            </div>
            <Link href="/search" className="w-fit rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b] hover:bg-[#f8fafc]">
              Mở trang tìm kiếm
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricCard title="Lượt tìm kiếm" value={formatNumber(overview.searchAnalytics.metrics.totalSearches)} tone="blue" />
            <MetricCard title="Không có kết quả" value={formatNumber(overview.searchAnalytics.metrics.emptySearches)} tone={overview.searchAnalytics.metrics.emptySearches ? "amber" : "green"} />
            <MetricCard title="Tỷ lệ có kết quả" value={`${formatNumber(overview.searchAnalytics.metrics.successRate)}%`} tone="green" />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-4">
            <SearchAnalyticsList
              title="Top từ khóa"
              empty="Chưa có lượt tìm kiếm."
              items={overview.searchAnalytics.topKeywords.map((item) => ({
                label: item.keyword,
                value: formatNumber(item.count),
              }))}
            />
            <SearchAnalyticsList
              title="Cần bổ sung nội dung"
              empty="Chưa có từ khóa rỗng."
              tone="amber"
              items={overview.searchAnalytics.emptyKeywords.map((item) => ({
                label: item.keyword,
                value: formatNumber(item.count),
              }))}
            />
            <SearchAnalyticsList
              title="Theo loại dữ liệu"
              empty="Chưa có dữ liệu loại."
              items={overview.searchAnalytics.byType.map((item) => ({
                label: searchTypeLabel[item.type] || item.type,
                value: formatNumber(item.count),
              }))}
            />
            <SearchAnalyticsList
              title="Theo nguồn"
              empty="Chưa có dữ liệu nguồn."
              items={overview.searchAnalytics.bySource.map((item) => ({
                label: searchSourceLabel[item.source] || item.source,
                value: formatNumber(item.count),
              }))}
            />
          </div>
        </section>
      ) : null}

      {overview ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-[#dce3ee] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Lịch hẹn theo ngày</h3>
                <p className="mt-1 text-sm text-[#667892]">Tổng lịch, hoàn tất và hủy/no-show.</p>
              </div>
              <Link href="/dashboard/appointments" className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Mở lịch hẹn</Link>
            </div>
            <div className="mt-4 h-72">
              {hasAppointmentTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appointmentDaily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={numberTooltip} />
                    <Legend />
                    <Bar dataKey="total" name="Tổng" fill="#0d4f8b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Hoàn tất" fill="#2a7f62" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelled" name="Hủy" fill="#b3261e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="Chưa có lịch hẹn trong khoảng thời gian này." />}
            </div>
          </div>

          <aside className="rounded-md border border-[#dce3ee] bg-white p-5">
            <h3 className="font-semibold">Cần xử lý ngay</h3>
            <p className="mt-1 text-sm text-[#667892]">Các điểm nên kiểm tra trước trong ca vận hành.</p>
            <div className="mt-4 space-y-3">
              <ActionRow title="Lịch chờ xác nhận" value={formatNumber(overview.metrics.pendingConfirmAppointments)} href="/dashboard/appointments" tone="amber" />
              <ActionRow title="Tư vấn cần xử lý" value={formatNumber(overview.metrics.pendingConsultationRequests)} href="/dashboard/consultation-requests?status=NEW" tone="amber" />
              <ActionRow title="Hoàn tất chưa có hóa đơn" value={formatNumber(overview.metrics.completedWithoutInvoiceAppointments)} href="/dashboard/invoices" tone="amber" />
              <ActionRow title="Hóa đơn chưa thanh toán" value={formatNumber(overview.metrics.unpaidInvoices)} href="/dashboard/invoices" tone="amber" />
              <ActionRow title="Hủy / no-show trong kỳ" value={formatNumber(overview.metrics.cancelledAppointments)} href="/dashboard/appointments" tone="red" />
              <ActionRow title="Lịch hẹn hôm nay" value={formatNumber(overview.metrics.todayAppointments)} href="/dashboard/appointments" tone="blue" />
            </div>
          </aside>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-md border border-[#dce3ee] bg-white p-5">
          <h3 className="font-semibold">Doanh thu theo ngày</h3>
          <p className="mt-1 text-sm text-[#667892]">Đã thu, hoàn tiền và doanh thu thuần.</p>
          <div className="mt-4 h-72">
            {hasRevenueTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueDaily}>
                  <defs>
                    <linearGradient id="netRevenue" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#0d4f8b" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#0d4f8b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
                  <Tooltip formatter={currencyTooltip} />
                  <Legend />
                  <Area type="monotone" dataKey="netAmount" name="Thuần" stroke="#0d4f8b" fill="url(#netRevenue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="collectedAmount" name="Đã thu" stroke="#2a7f62" fill="#2a7f6222" strokeWidth={2} />
                  <Area type="monotone" dataKey="refundedAmount" name="Hoàn" stroke="#b3261e" fill="#b3261e18" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Chưa có doanh thu trong khoảng thời gian này." />}
          </div>
        </div>

        <div className="rounded-md border border-[#dce3ee] bg-white p-5">
          <h3 className="font-semibold">Hóa đơn và thanh toán</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-[#f8fafc] p-3"><p className="text-[#667892]">Số hóa đơn</p><p className="mt-1 font-semibold">{formatNumber(revenue?.metrics.invoiceCount || 0)}</p></div>
            <div className="rounded-md bg-[#f8fafc] p-3"><p className="text-[#667892]">Hoàn tiền</p><p className="mt-1 font-semibold">{formatCurrency(revenue?.metrics.refundedAmount || 0)}</p></div>
          </div>
          <div className="mt-4 h-56">
            {hasPaymentMethod ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethodData} dataKey="amount" nameKey="label" innerRadius={44} outerRadius={78} paddingAngle={2}>
                    {paymentMethodData.map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={currencyTooltip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Chưa có thanh toán trong khoảng này." />}
          </div>
          <div className="mt-4 space-y-2">
            {invoiceStatusData.length ? invoiceStatusData.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-md border border-[#eef2f7] px-3 py-2 text-sm">
                <span>{item.label}</span>
                <span className="font-semibold">{formatNumber(item.count)} - {formatCurrency(item.amount)}</span>
              </div>
            )) : <p className="rounded-md bg-[#f8fafc] p-3 text-sm text-[#667892]">Chưa có dữ liệu hóa đơn.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-md border border-[#dce3ee] bg-white p-5">
          <h3 className="font-semibold">Trạng thái lịch hẹn</h3>
          <div className="mt-4 h-72">
            {hasAppointmentStatus ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appointmentStatusData} layout="vertical" margin={{ left: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={122} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={numberTooltip} />
                  <Bar dataKey="count" name="Số lịch" fill="#0d4f8b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Chưa có trạng thái lịch hẹn để hiển thị." />}
          </div>
        </div>

        <div className="rounded-md border border-[#dce3ee] bg-white p-5">
          <h3 className="font-semibold">Top bác sĩ</h3>
          <div className="mt-4 space-y-3">
            {doctors?.items.length ? doctors.items.map((item) => (
              <div key={item.doctor.id} className="rounded-md border border-[#eef2f7] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.doctor.user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.doctor.user.avatar} alt={item.doctor.user.fullName} loading="lazy" decoding="async" className="h-10 w-10 rounded-md object-cover" />
                    ) : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e7f0fb] text-sm font-semibold text-[#0d4f8b]">{item.doctor.user.fullName.slice(0, 1).toUpperCase()}</div>}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.doctor.title ? `${item.doctor.title} ` : ""}{item.doctor.user.fullName}</p>
                      <p className="mt-1 truncate text-xs text-[#667892]">{item.doctor.department.name} - {item.doctor.specialization || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-[#e7f0fb] px-2 py-1 text-sm font-semibold text-[#0d4f8b]">{item.appointmentCount}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  {item.slots.map((slot) => <div key={slot.status} className="rounded-md bg-[#f8fafc] px-2 py-1"><p className="text-[#667892]">{slotLabel[slot.status] || slot.status}</p><p className="font-semibold">{slot.count}</p></div>)}
                </div>
              </div>
            )) : <p className="py-8 text-center text-sm text-[#667892]">Chưa có dữ liệu bác sĩ trong khoảng này.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-md border border-[#dce3ee] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Top chuyên khoa</h3>
              <p className="mt-1 text-sm text-[#667892]">{departments?.activeDepartments || 0}/{departments?.totalDepartments || 0} khoa đang hoạt động</p>
            </div>
            <Link href="/dashboard/departments" className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Mở khoa</Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-sm">
              <thead><tr className="text-[#667892]"><th className="border-b border-[#e5ebf3] py-3 font-semibold">Chuyên khoa</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Lịch</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Ước tính</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Nguồn lực</th></tr></thead>
              <tbody>
                {departments?.items.length ? departments.items.map((item, index) => (
                  <tr key={item.department?.id || index}>
                    <td className="border-b border-[#eef2f7] py-3"><p className="font-semibold">{item.department?.name || "Không rõ"}</p><p className="mt-1 text-xs text-[#667892]">{item.department?.isActive ? "Đang hoạt động" : "Tạm tắt"}</p></td>
                    <td className="border-b border-[#eef2f7] py-3">{formatNumber(item.appointmentCount)}</td>
                    <td className="border-b border-[#eef2f7] py-3">{formatCurrency(item.estimatedAmount)}</td>
                    <td className="border-b border-[#eef2f7] py-3">{item.department?._count.doctors || 0} BS - {item.department?._count.packages || 0} gói</td>
                  </tr>
                )) : <tr><td colSpan={4} className="py-8 text-center text-[#667892]">Chưa có dữ liệu chuyên khoa.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-[#dce3ee] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Lịch hẹn mới nhất</h3>
              <p className="mt-1 text-sm text-[#667892]">5 lịch gần nhất trong khoảng thống kê.</p>
            </div>
            <Link href="/dashboard/appointments" className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Xem tất cả</Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead><tr className="text-[#667892]"><th className="border-b border-[#e5ebf3] py-3 font-semibold">Mã lịch</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Bệnh nhân</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Bác sĩ</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Thời gian</th><th className="border-b border-[#e5ebf3] py-3 font-semibold">Trạng thái</th></tr></thead>
              <tbody>
                {overview?.latestAppointments.length ? overview.latestAppointments.map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-[#eef2f7] py-3 font-semibold">{item.bookingCode}</td>
                    <td className="border-b border-[#eef2f7] py-3"><p>{item.patientName}</p><p className="mt-1 text-xs text-[#667892]">{item.patientPhone}</p></td>
                    <td className="border-b border-[#eef2f7] py-3">{item.doctor.title ? `${item.doctor.title} ` : ""}{item.doctor.user.fullName}</td>
                    <td className="border-b border-[#eef2f7] py-3">{formatDateTime(item.appointmentDate)} - {item.startTime}</td>
                    <td className="border-b border-[#eef2f7] py-3"><span className="rounded-md bg-[#f1f5f9] px-2 py-1 text-xs font-semibold text-[#42526b]">{statusLabel[item.status] || item.status}</span></td>
                  </tr>
                )) : <tr><td colSpan={5} className="py-8 text-center text-[#667892]">Chưa có lịch hẹn trong khoảng này.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;

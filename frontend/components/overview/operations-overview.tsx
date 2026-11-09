"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsNotice,
  DsPageHeader,
  DsPanel,
  DsStatusPill,
  type DsColumn,
} from "@/components/ds";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { useDashboardStatistics } from "@/lib/dashboard-overview-query";
import { appointmentStatusLabel, appointmentStatusTone } from "@/lib/appointment-status";
import { formatVietnamDate, formatVietnamDateTime, getVietnamDateInput } from "@/lib/date";
import type { PaymentMethod } from "@/lib/types";

// Tổng quan vận hành cho quản trị và nhân viên: việc cần xử lý trước, số liệu trong kỳ, hai biểu đồ chính
// (lịch hẹn, doanh thu) và các bảng top. Mỗi con số chỉ xuất hiện một lần.

const paymentLabel: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  VNPAY: "VNPay",
  OTHER: "Khác",
};

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value || 0);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
const compactCurrency = (value: number) => {
  if (!value) return "0";
  if (Math.abs(value) >= 1_000_000_000) return `${Math.round(value / 1_000_000_000)} tỷ`;
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)} tr`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
};
const percent = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "0%");
const tooltipNumber = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
};

const addDays = (date: string, days: number) => {
  const base = new Date(`${date}T00:00:00+07:00`);
  base.setDate(base.getDate() + days);
  return getVietnamDateInput(base);
};

const monthRange = () => {
  const today = getVietnamDateInput();
  const [year, month] = today.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
};

const axisTick = { fill: "var(--ds-muted)", fontSize: 12 };
const tooltipStyle = {
  background: "var(--ds-surface)",
  border: "1px solid var(--ds-line)",
  borderRadius: 8,
  color: "var(--ds-ink)",
  fontSize: 12,
};

type Tile = { id: string; label: string; value: number; href: string };

export function OperationsOverview() {
  const initial = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [range, setRange] = useState(initial);

  const query = useDashboardStatistics(range, true);
  const data = query.data ?? null;
  const overview = data?.overview ?? null;
  const metrics = overview?.metrics ?? null;

  const apply = (next: { from: string; to: string }) => {
    setFrom(next.from);
    setTo(next.to);
    setRange(next);
  };

  const lastDays = (days: number) => {
    const end = getVietnamDateInput();
    apply({ from: addDays(end, -(days - 1)), to: end });
  };

  const tiles: Tile[] = metrics
    ? [
        { id: "confirm", label: "Chờ xác nhận", value: metrics.pendingConfirmAppointments, href: "/dashboard/appointments" },
        { id: "invoice", label: "Cần tạo hóa đơn", value: metrics.completedWithoutInvoiceAppointments, href: "/dashboard/invoices" },
        { id: "unpaid", label: "Hóa đơn chưa thanh toán", value: metrics.unpaidInvoices, href: "/dashboard/invoices" },
        { id: "today", label: "Lịch hôm nay", value: metrics.todayAppointments, href: "/dashboard/appointments" },
      ]
    : [];

  const appointmentDaily = (data?.appointments.daily ?? []).map((item) => ({ ...item, label: formatVietnamDate(item.date), other: Math.max(0, item.total - item.completed - item.cancelled) }));
  const revenueDaily = (data?.revenue.daily ?? []).map((item) => ({ ...item, label: formatVietnamDate(item.date) }));
  const hasAppointmentChart = appointmentDaily.some((item) => item.total > 0);
  const hasRevenueChart = revenueDaily.some((item) => item.collectedAmount > 0 || item.refundedAmount > 0 || item.netAmount > 0);
  const payments = (data?.revenue.byPaymentMethod ?? []).filter((item) => item.amount > 0 || item.count > 0);

  const doctorColumns: DsColumn<NonNullable<typeof data>["doctors"]["items"][number]>[] = [
    {
      key: "doctor",
      header: "Bác sĩ",
      cell: (row) => (
        <div>
          <strong>{[row.doctor.title, row.doctor.user.fullName].filter(Boolean).join(" ")}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.doctor.department.name}</div>
        </div>
      ),
    },
    { key: "count", header: "Lịch", align: "num", cell: (row) => formatNumber(row.appointmentCount) },
    {
      key: "slots",
      header: "Slot trống / đã đặt",
      align: "num",
      cell: (row) => {
        const get = (status: string) => row.slots.find((slot) => slot.status === status)?.count ?? 0;
        return `${get("AVAILABLE")} / ${get("BOOKED")}`;
      },
    },
  ];

  const departmentColumns: DsColumn<NonNullable<typeof data>["departments"]["items"][number]>[] = [
    { key: "name", header: "Chuyên khoa", cell: (row) => <strong>{row.department?.name || "Không rõ"}</strong> },
    { key: "count", header: "Lịch", align: "num", cell: (row) => formatNumber(row.appointmentCount) },
    { key: "amount", header: "Ước tính", align: "num", cell: (row) => formatCurrency(row.estimatedAmount) },
  ];

  type Latest = NonNullable<typeof overview>["latestAppointments"][number];
  const latestColumns: DsColumn<Latest>[] = [
    { key: "code", header: "Mã lịch", mono: true, cell: (row) => row.bookingCode },
    { key: "patient", header: "Người khám", cell: (row) => <strong>{row.patientName}</strong> },
    {
      key: "doctor",
      header: "Bác sĩ",
      cell: (row) => [row.doctor.title, row.doctor.user.fullName].filter(Boolean).join(" "),
    },
    { key: "time", header: "Thời gian", cell: (row) => `${formatVietnamDateTime(row.appointmentDate).slice(0, 10)} · ${row.startTime}` },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => <DsStatusPill tone={appointmentStatusTone(row.status)}>{appointmentStatusLabel[row.status]}</DsStatusPill>,
    },
  ];

  const error = query.error instanceof Error ? query.error.message : query.error ? "Không tải được thống kê" : "";
  const rangeText = `${formatVietnamDate(range.from)} – ${formatVietnamDate(range.to)}`;

  return (
    <>
      <DsPageHeader
        title="Tổng quan vận hành"
        description={`Hoạt động khám và doanh thu ${rangeText}`}
        actions={
          <DsButton onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Làm mới dữ liệu">
            Làm mới
          </DsButton>
        }
      />

      <form
        className="ds-toolbar ds-period"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ from, to });
        }}
        aria-label="Chọn khoảng thời gian"
      >
        <DsButton type="button" onClick={() => lastDays(7)}>7 ngày</DsButton>
        <DsButton type="button" onClick={() => lastDays(30)}>30 ngày</DsButton>
        <DsButton type="button" onClick={() => apply(monthRange())}>Tháng này</DsButton>
        <span className="ds-period__sep" aria-hidden="true" />
        <label className="ds-period__field">
          <span>Từ</span>
          <VietnamDateInput value={from} onChange={setFrom} ariaLabel="Từ ngày thống kê" className="ds-input" />
        </label>
        <label className="ds-period__field">
          <span>Đến</span>
          <VietnamDateInput value={to} onChange={setTo} ariaLabel="Đến ngày thống kê" className="ds-input" />
        </label>
        <DsButton type="submit" variant="primary">Áp dụng</DsButton>
      </form>

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {error ? <DsNotice tone="bad">{error}</DsNotice> : null}

        <section aria-label="Cần xử lý" className="ds-attn-grid">
          {query.isLoading
            ? Array.from({ length: 4 }, (_, index) => <div key={index} className="ds-attn" aria-hidden="true"><span className="ds-skel" style={{ width: "40%" }} /><span className="ds-skel" style={{ width: "25%", height: 24 }} /></div>)
            : tiles.map((tile) => (
                <Link key={tile.id} href={tile.href} className={`ds-attn${tile.value > 0 && tile.id !== "today" ? " is-warn" : ""}`}>
                  <span className="ds-attn__label">{tile.label}</span>
                  <strong className="ds-attn__value ds-num">{formatNumber(tile.value)}</strong>
                </Link>
              ))}
        </section>

        <DsPanel title="Trong kỳ">
          {metrics ? (
            <dl className="ds-stats">
              <div><dt>Tổng lịch hẹn</dt><dd className="ds-num">{formatNumber(metrics.totalAppointments)}</dd></div>
              <div><dt>Hoàn tất</dt><dd className="ds-num">{formatNumber(metrics.completedAppointments)}</dd><small>{percent(metrics.completedAppointments, metrics.totalAppointments)} tổng lịch</small></div>
              <div><dt>Hủy hoặc vắng</dt><dd className="ds-num">{formatNumber(metrics.cancelledAppointments)}</dd><small>{percent(metrics.cancelledAppointments, metrics.totalAppointments)} tổng lịch</small></div>
              <div><dt>Người khám mới</dt><dd className="ds-num">{formatNumber(metrics.newPatients)}</dd></div>
              <div><dt>Đã thu</dt><dd className="ds-num">{formatCurrency(metrics.collectedAmount)}</dd></div>
              <div><dt>Doanh thu thuần</dt><dd className="ds-num">{formatCurrency(metrics.netAmount)}</dd><small>Đã hoàn {formatCurrency(metrics.refundedAmount)}</small></div>
            </dl>
          ) : (
            <span className="ds-skel" style={{ width: "100%", height: 48 }} />
          )}
        </DsPanel>

        <div className="ds-grid2">
          <DsPanel
            title="Lịch hẹn theo ngày"
            actions={<Link href="/dashboard/appointments" className="ds-link">Mở lịch hẹn</Link>}
          >
            {hasAppointmentChart ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={appointmentDaily}>
                    <CartesianGrid stroke="var(--ds-line)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(tooltipNumber(value))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" name="Hoàn tất" stackId="a" fill="var(--ds-good)" />
                    <Bar dataKey="other" name="Khác" stackId="a" fill="var(--ds-accent)" />
                    <Bar dataKey="cancelled" name="Hủy hoặc vắng" stackId="a" fill="var(--ds-bad)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <DsEmptyState title="Chưa có lịch hẹn trong kỳ" description="Chọn khoảng thời gian khác để xem." />
            )}
          </DsPanel>

          <DsPanel
            title="Doanh thu theo ngày"
            actions={
              <ExportCsvButton
                path="/dashboard/statistics/revenue/export"
                fallbackName="doanh-thu.csv"
                params={{ from: range.from, to: range.to }}
                ranged={false}
                label="Xuất CSV"
              />
            }
          >
            {hasRevenueChart ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={revenueDaily}>
                    <CartesianGrid stroke="var(--ds-line)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={compactCurrency} tick={axisTick} tickLine={false} axisLine={false} width={48} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(tooltipNumber(value))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="collectedAmount" name="Đã thu" stroke="var(--ds-good)" fill="var(--ds-good)" fillOpacity={0.12} strokeWidth={2} />
                    <Area type="monotone" dataKey="netAmount" name="Thuần" stroke="var(--ds-accent)" fill="var(--ds-accent)" fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <DsEmptyState title="Chưa có doanh thu trong kỳ" description="Doanh thu hiện sau khi có hóa đơn được thanh toán." />
            )}
            {payments.length ? (
              <p className="ds-hint" style={{ margin: "12px 0 0" }}>
                Theo phương thức: {payments.map((item) => `${paymentLabel[item.paymentMethod] ?? item.paymentMethod} ${formatCurrency(item.amount)}`).join(" · ")}
              </p>
            ) : null}
          </DsPanel>
        </div>

        <div className="ds-grid2">
          <DsPanel title="Top bác sĩ" actions={<Link href="/dashboard/doctors" className="ds-link">Mở danh sách</Link>} flush>
            <DsDataTable
              caption="Bác sĩ có nhiều lịch hẹn nhất trong kỳ"
              columns={doctorColumns}
              rows={data?.doctors.items ?? []}
              rowKey={(row) => row.doctor.id}
              loading={query.isLoading}
              emptyTitle="Chưa có dữ liệu bác sĩ"
            />
          </DsPanel>
          <DsPanel
            title="Top chuyên khoa"
            actions={<span className="ds-hint">{data?.departments.activeDepartments ?? 0}/{data?.departments.totalDepartments ?? 0} khoa đang hoạt động</span>}
            flush
          >
            <DsDataTable
              caption="Chuyên khoa có nhiều lịch hẹn nhất trong kỳ"
              columns={departmentColumns}
              rows={data?.departments.items ?? []}
              rowKey={(row) => row.department?.id ?? String(row.appointmentCount)}
              loading={query.isLoading}
              emptyTitle="Chưa có dữ liệu chuyên khoa"
            />
          </DsPanel>
        </div>

        <DsPanel title="Lịch hẹn mới nhất" actions={<Link href="/dashboard/appointments" className="ds-link">Xem tất cả</Link>} flush>
          <DsDataTable
            caption="Lịch hẹn mới nhất trong kỳ"
            columns={latestColumns}
            rows={overview?.latestAppointments ?? []}
            rowKey={(row) => row.id}
            loading={query.isLoading}
            emptyTitle="Chưa có lịch hẹn trong kỳ"
          />
        </DsPanel>
      </div>
    </>
  );
}

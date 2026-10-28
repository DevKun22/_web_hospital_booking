"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelRightOpen, Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardPageHeader, DashboardStatusBadge, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardAppointments } from "@/lib/dashboard-appointments-query";
import { useDashboardInvoice, useDashboardInvoices } from "@/lib/dashboard-invoices-query";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import type { Appointment, InsuranceRouteType, Invoice, InvoiceStatus, PaymentMethod } from "@/lib/types";

type InvoiceAction = "pay" | "cancel" | "refund" | "adjust";
type InsuranceForm = {
  eligibleAmount: string;
  coverageRate: string;
  routeType: InsuranceRouteType;
  note: string;
};

const statusOptions: { value: "" | InvoiceStatus; label: string }[] = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "UNPAID", label: "Chưa thanh toán" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "REFUNDED", label: "Đã hoàn tiền" },
];

const paymentOptions: { value: "" | PaymentMethod; label: string }[] = [
  { value: "", label: "Tất cả phương thức" },
  { value: "CASH", label: "Tiền mặt" },
  { value: "CARD", label: "Thẻ" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "MOMO", label: "MoMo" },
  { value: "VNPAY", label: "VNPay" },
  { value: "OTHER", label: "Khác" },
];

const manualPayments: { value: Exclude<PaymentMethod, "MOMO" | "VNPAY">; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "CARD", label: "Thẻ" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "OTHER", label: "Khác" },
];

const insuranceCoverageOptions = ["0", "80", "95", "100"];

const insuranceRouteOptions: { value: InsuranceRouteType; label: string }[] = [
  { value: "RIGHT_ROUTE", label: "Đúng tuyến" },
  { value: "WRONG_ROUTE", label: "Trái tuyến" },
  { value: "REFERRAL", label: "Chuyển tuyến" },
  { value: "EMERGENCY", label: "Cấp cứu" },
  { value: "SERVICE", label: "Dịch vụ" },
];

const defaultInsuranceForm: InsuranceForm = {
  eligibleAmount: "",
  coverageRate: "80",
  routeType: "RIGHT_ROUTE",
  note: "",
};

const insuranceRouteLabel: Record<InsuranceRouteType, string> = {
  RIGHT_ROUTE: "Đúng tuyến",
  WRONG_ROUTE: "Trái tuyến",
  REFERRAL: "Chuyển tuyến",
  EMERGENCY: "Cấp cứu",
  SERVICE: "Dịch vụ",
};

const statusLabel: Record<InvoiceStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

const paymentLabel: Partial<Record<PaymentMethod, string>> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  MOMO: "MoMo",
  VNPAY: "VNPay",
  OTHER: "Khác",
};

const transactionStatusLabel = {
  PENDING: "Đang chờ",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
} as const;

const transactionStatusClass = {
  PENDING: "bg-[#fff4d6] text-[#8a5a00]",
  SUCCESS: "bg-[#e7f6ed] text-[#1f7a3a]",
  FAILED: "bg-[#fff3f2] text-[#b3261e]",
  CANCELLED: "bg-[#eef2f7] text-[#667892]",
  EXPIRED: "bg-[#eef2f7] text-[#667892]",
} as const;

const statusTone: Record<InvoiceStatus, "warning" | "positive" | "danger" | "neutral"> = {
  UNPAID: "warning",
  PAID: "positive",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) => formatVietnamDate(value);

const parseMoneyInput = (value: string) => value.replace(/\D/g, "");

const formatMoneyInput = (value: string) => {
  const digits = parseMoneyInput(value);
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};

const toMoneyNumber = (value: string) => Number(parseMoneyInput(value) || 0);

const calculateInsuranceDiscount = (form: InsuranceForm) =>
  Math.floor((toMoneyNumber(form.eligibleAmount) * Number(form.coverageRate || 0)) / 100);

const buildInsuranceForm = (invoice: Invoice): InsuranceForm => ({
  eligibleAmount: invoice.insuranceEligibleAmount ? String(invoice.insuranceEligibleAmount) : "",
  coverageRate: String(invoice.insuranceCoverageRate || 80),
  routeType: invoice.insuranceRouteType || "RIGHT_ROUTE",
  note: invoice.insuranceNote || "",
});

const buildInsurancePayload = (form: InsuranceForm) => {
  const eligibleAmount = toMoneyNumber(form.eligibleAmount);

  return {
    insuranceEligibleAmount: eligibleAmount,
    insuranceCoverageRate: eligibleAmount > 0 ? Number(form.coverageRate || 0) : 0,
    insuranceRouteType: eligibleAmount > 0 ? form.routeType : null,
    insuranceNote: eligibleAmount > 0 ? form.note.trim() || null : null,
  };
};

const doctorName = (invoice: Invoice) =>
  [invoice.appointment.doctor.title, invoice.appointment.doctor.user.fullName]
    .filter(Boolean)
    .join(" ");

const appointmentDoctorName = (appointment: Appointment) =>
  [appointment.doctor.title, appointment.doctor.user.fullName]
    .filter(Boolean)
    .join(" ");

export default function InvoicesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [phone, setPhone] = useState("");
  const [invoiceCode, setInvoiceCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [appliedPhone, setAppliedPhone] = useState("");
  const [appliedInvoiceCode, setAppliedInvoiceCode] = useState("");
  const [appliedBarcode, setAppliedBarcode] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedSnapshot, setSelected] = useState<Invoice | null>(null);
  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentLookupKey, setAppointmentLookupKey] = useState("");
  const [insuranceForm, setInsuranceForm] = useState<InsuranceForm>(defaultInsuranceForm);
  const [actionTarget, setActionTarget] = useState<{ type: InvoiceAction; invoice: Invoice } | null>(null);
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMethod, "MOMO" | "VNPAY">>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [adjustInsuranceForm, setAdjustInsuranceForm] = useState<InsuranceForm>(defaultInsuranceForm);
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const listRef = useRef<HTMLElement | null>(null);
  const createRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const canUse = user?.role === "ADMIN" || user?.role === "STAFF";
  const canRefund = user?.role === "ADMIN";
  const createDiscount = calculateInsuranceDiscount(insuranceForm);
  const adjustedDiscount = calculateInsuranceDiscount(adjustInsuranceForm);
  const adjustedFinalAmount = actionTarget?.type === "adjust"
    ? Math.max(actionTarget.invoice.totalAmount - adjustedDiscount, 0)
    : 0;

  const query = useMemo(
    () => ({
      status: status || undefined,
      paymentMethod: paymentMethod || undefined,
      phone: appliedPhone || undefined,
      invoiceCode: appliedInvoiceCode || undefined,
      barcode: appliedBarcode || undefined,
      page,
      limit: 20,
    }),
    [appliedBarcode, appliedInvoiceCode, appliedPhone, page, paymentMethod, status],
  );
  const invoicesQuery = useDashboardInvoices(query);
  const appointmentPreviewQuery = useDashboardAppointments(
    {
      bookingCode: appointmentLookupKey || undefined,
      page: 1,
      limit: 1,
    },
    Boolean(appointmentLookupKey) && canUse,
  );
  const selectedInvoiceQuery = useDashboardInvoice(selectedSnapshot?.id);
  const loading = invoicesQuery.isLoading;
  const invoices = invoicesQuery.data?.items ?? [];
  const pagination = invoicesQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedInvoiceQuery.data ?? selectedSnapshot;
  const appointmentPreview = appointmentPreviewQuery.data?.items[0] ?? null;
  const queryError = invoicesQuery.error || selectedInvoiceQuery.error || appointmentPreviewQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu hóa đơn"
    : "";
  const visibleError = error || queryErrorMessage;
  const appointmentReadyForInvoice = Boolean(
    appointmentPreview &&
    appointmentPreview.status === "COMPLETED" &&
    !appointmentPreview.invoice,
  );

  const invalidateInvoices = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInvoices }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
    ]);
  };

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const appointmentCode = params.get("appointment") || params.get("appointmentId") || params.get("bookingCode");
      const initialInvoiceCode = params.get("invoiceCode");

      if (appointmentCode) {
        const normalizedAppointmentCode = appointmentCode.trim().toUpperCase();
        setWorkspaceOpen(true);
        setAppointmentId(normalizedAppointmentCode);
        setAppointmentLookupKey(normalizedAppointmentCode);
        scrollTo(createRef);
      }

      if (initialInvoiceCode) {
        const normalizedInvoiceCode = initialInvoiceCode.trim().toUpperCase();
        setInvoiceCode(normalizedInvoiceCode);
        setAppliedInvoiceCode(normalizedInvoiceCode);
        setPage(1);
        scrollTo(listRef);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedPhone(phone.trim());
    setAppliedInvoiceCode(invoiceCode.trim());
    setAppliedBarcode(barcode.trim());
    setPage(1);
  };

  const createInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUse) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const invoice = await apiRequest<Invoice>(`/dashboard/invoices/appointments/${appointmentId}`, {
        method: "POST",
        body: buildInsurancePayload(insuranceForm),
      });
      setSelected(invoice);
      setWorkspaceOpen(true);
      setAppointmentId("");
      setAppointmentLookupKey("");
      setInsuranceForm(defaultInsuranceForm);
      setNotice("Đã phát hành hóa đơn");
      await invalidateInvoices();
      scrollTo(detailRef);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const refreshedAppointment = await appointmentPreviewQuery.refetch();
          const existingInvoiceId = refreshedAppointment.data?.items[0]?.invoice?.id;
          await invalidateInvoices();

          if (existingInvoiceId) {
            const existingInvoice = await apiRequest<Invoice>(
              `/dashboard/invoices/${existingInvoiceId}`,
            );
            setSelected(existingInvoice);
            setNotice("Hóa đơn đã được phát hành ở một thao tác khác. Đã mở hóa đơn hiện có.");
            scrollTo(detailRef);
            return;
          }
        } catch (recoveryError) {
          setError(
            recoveryError instanceof Error
              ? recoveryError.message
              : "Hóa đơn đã được phát hành nhưng chưa thể tải lại dữ liệu",
          );
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Không tạo được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  const inspectAppointment = () => {
    const normalized = appointmentId.trim().toUpperCase();
    setAppointmentId(normalized);
    setAppointmentLookupKey(normalized);
    setError("");
    setNotice("");
  };

  const openDetail = (invoice: Invoice) => {
    setSelected(invoice);
    setWorkspaceOpen(true);
    setActionTarget(null);
    setRefundReason("");
    setRefundReference("");
    setPaymentReference("");
    setAdjustInsuranceForm(defaultInsuranceForm);
    setPayMethod("CASH");
    scrollTo(detailRef);
  };

  const startAction = (type: InvoiceAction, invoice: Invoice) => {
    setSelected(invoice);
    setWorkspaceOpen(true);
    setActionTarget({ type, invoice });
    setRefundReason("");
    setRefundReference("");
    setPaymentReference("");
    setAdjustInsuranceForm(type === "adjust" ? buildInsuranceForm(invoice) : defaultInsuranceForm);
    setPayMethod("CASH");
    setError("");
    setNotice("");
    scrollTo(detailRef);
  };

  const updateSelectedInvoice = async (invoice: Invoice, message: string) => {
    setSelected(invoice);
    setActionTarget(null);
    setRefundReason("");
    setRefundReference("");
    setPaymentReference("");
    setAdjustInsuranceForm(defaultInsuranceForm);
    setNotice(message);
    await invalidateInvoices();
    scrollTo(detailRef);
  };

  const payInvoice = async () => {
    if (!actionTarget || actionTarget.type !== "pay") return;
    if (["CARD", "BANK_TRANSFER"].includes(payMethod) && paymentReference.trim().length < 3) {
      setError("Vui lòng nhập mã tham chiếu của giao dịch");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}/pay`, {
        method: "PATCH",
        body: {
          paymentMethod: payMethod,
          paymentReference: paymentReference.trim() || null,
        },
      });
      await updateSelectedInvoice(updated, "Đã thanh toán hóa đơn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thanh toán được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  const cancelInvoice = async () => {
    if (!actionTarget || actionTarget.type !== "cancel") return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}/cancel`, {
        method: "PATCH",
      });
      await updateSelectedInvoice(updated, "Đã hủy hóa đơn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  const adjustInvoice = async () => {
    if (!actionTarget || actionTarget.type !== "adjust") return;
    if (adjustedDiscount > actionTarget.invoice.totalAmount) {
      setError("Giảm trừ BHYT không được lớn hơn tổng tiền");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}`, {
        method: "PATCH",
        body: buildInsurancePayload(adjustInsuranceForm),
      });
      await updateSelectedInvoice(
        updated,
        actionTarget.invoice.status === "CANCELLED"
          ? "Đã điều chỉnh và mở lại hóa đơn"
          : "Đã điều chỉnh hóa đơn",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không điều chỉnh được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  const refundInvoice = async () => {
    if (!actionTarget || actionTarget.type !== "refund") return;
    if (refundReason.trim().length < 5) {
      setError("Lý do hoàn tiền phải có ít nhất 5 ký tự");
      return;
    }
    if (
      (actionTarget.invoice.paymentMethod === "MOMO" || actionTarget.invoice.paymentMethod === "VNPAY") &&
      refundReference.trim().length < 3
    ) {
      setError("Vui lòng nhập mã tham chiếu do cổng thanh toán trả về");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}/refund`, {
        method: "PATCH",
        body: {
          refundReason: refundReason.trim(),
          refundReference: refundReference.trim() || null,
        },
      });
      await updateSelectedInvoice(updated, "Đã hoàn tiền hóa đơn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tiền được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (invoice: Invoice) => (
    <>
      {invoice.status === "UNPAID" ? (
        <>
          <button disabled={busy} onClick={() => startAction("adjust", invoice)} className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b]">Chỉnh giảm</button>
          <button disabled={busy} onClick={() => startAction("pay", invoice)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Ghi nhận thu tại quầy</button>
          <button disabled={busy} onClick={() => startAction("cancel", invoice)} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Hủy</button>
        </>
      ) : null}
      {invoice.status === "CANCELLED" ? (
        <button disabled={busy} onClick={() => startAction("adjust", invoice)} className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b]">Chỉnh và mở lại</button>
      ) : null}
      {canRefund && invoice.status === "PAID" ? (
        <button disabled={busy} onClick={() => startAction("refund", invoice)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Hoàn tiền</button>
      ) : null}
    </>
  );

  if (!canUse) {
    return (
      <DashboardPageHeader eyebrow="Tài chính" title="Hóa đơn" description="Phân hệ hóa đơn chỉ dành cho quản trị viên và nhân viên vận hành." />
    );
  }

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_410px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section ref={listRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader
          eyebrow="Tài chính"
          title="Hóa đơn"
          description="Tạo hóa đơn từ lịch hẹn hoàn thành, áp dụng BHYT và kiểm soát thanh toán, hủy hoặc hoàn tiền."
          actions={!workspaceOpen ? <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}><PanelRightOpen />Mở công cụ hóa đơn</Button> : undefined}
        />

        <DashboardSurface>
          <form onSubmit={applySearch} className="grid gap-3 border-b border-border p-4 lg:grid-cols-2 2xl:grid-cols-[170px_170px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {paymentOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <Input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" />
            <Input value={invoiceCode} onChange={(e) => setInvoiceCode(e.target.value)} placeholder="Mã hóa đơn" />
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Mã vạch" />
            <Button type="submit"><Search />Tìm kiếm</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Hóa đơn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bệnh nhân</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Số tiền</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Đang tải hóa đơn...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Chưa có hóa đơn phù hợp</td></tr>
                ) : invoices.map((invoice) => (
                  <tr key={invoice.id} className="align-top">
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <button onClick={() => openDetail(invoice)} className="font-semibold text-[#0d4f8b] hover:underline">{invoice.invoiceCode}</button>
                      <p className="mt-1 text-xs text-[#667892]">{invoice.barcode}</p>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold">{invoice.patient.fullName}</p><p className="mt-1 text-xs text-[#667892]">{invoice.patient.phone}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p>{invoice.appointment.bookingCode}</p><p className="mt-1 text-xs text-[#667892]">{formatDate(invoice.appointment.appointmentDate)} {invoice.appointment.startTime}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold">{formatCurrency(invoice.finalAmount)}</p><p className="mt-1 text-xs text-[#667892]">Giảm {formatCurrency(invoice.bhytDiscount)}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><DashboardStatusBadge tone={statusTone[invoice.status]}>{statusLabel[invoice.status]}</DashboardStatusBadge><p className="mt-1 text-xs text-[#667892]">{invoice.paymentMethod ? paymentLabel[invoice.paymentMethod] || invoice.paymentMethod : "-"}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => openDetail(invoice)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Chi tiết</button>
                        {renderActions(invoice)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
            <span>{pagination.total} kết quả, trang {pagination.page}/{pagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
            </div>
          </div>
        </DashboardSurface>
      </section>

      {workspaceOpen ? (
      <aside className="min-w-0">
        <DashboardWorkspace
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
          title={selected ? `Hóa đơn ${selected.invoiceCode}` : "Công cụ hóa đơn"}
          description="Tạo hóa đơn, áp dụng quyền lợi BHYT và xử lý thanh toán trong cùng một vùng làm việc."
        >
        <div className="space-y-4">
        <section ref={createRef} className="scroll-mt-24 rounded-md border border-[#dce3ee] bg-white p-5">
          <h3 className="text-lg font-semibold">Tạo hóa đơn</h3>
          <p className="mt-2 text-sm leading-6 text-[#667892]">Nhập mã lịch đã hoàn thành khám để kiểm tra người bệnh, dịch vụ và quyền lợi BHYT trước khi phát hành.</p>
          <form className="mt-5 space-y-4" onSubmit={createInvoice}>
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">Mã lịch hẹn</span>
              <span className="mt-1 flex gap-2">
                <input value={appointmentId} onChange={(e) => { setAppointmentId(e.target.value); setAppointmentLookupKey(""); }} placeholder="Ví dụ: HB-8492" className="min-w-0 flex-1 rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                <button type="button" disabled={!appointmentId.trim() || appointmentPreviewQuery.isFetching} onClick={inspectAppointment} className="shrink-0 rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-semibold text-[#42526b] disabled:opacity-50">
                  {appointmentPreviewQuery.isFetching ? "Đang kiểm tra..." : "Kiểm tra"}
                </button>
              </span>
            </label>
            {appointmentLookupKey && !appointmentPreviewQuery.isFetching ? (
              appointmentPreview ? (
                <div className={`rounded-lg border p-4 ${appointmentReadyForInvoice ? "border-[#bde5c8] bg-[#f0fff4]" : "border-[#f4d7a1] bg-[#fff8eb]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#172033]">{appointmentPreview.patientName}</p>
                      <p className="mt-1 text-xs text-[#667892]">{appointmentPreview.bookingCode} · {appointmentPreview.patientPhone}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${appointmentReadyForInvoice ? "bg-[#dff3e5] text-[#1f7a3a]" : "bg-[#fff0c2] text-[#8a5a00]"}`}>
                      {appointmentPreview.invoice ? "Đã có hóa đơn" : appointmentPreview.status === "COMPLETED" ? "Sẵn sàng phát hành" : "Chưa hoàn tất khám"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p><span className="text-[#667892]">Dịch vụ:</span> {appointmentPreview.package?.name || appointmentPreview.department.name}</p>
                    <p><span className="text-[#667892]">Bác sĩ:</span> {appointmentDoctorName(appointmentPreview)}</p>
                    <p><span className="text-[#667892]">Giá khám:</span> {formatCurrency(appointmentPreview.estimatedPrice)}</p>
                    <p><span className="text-[#667892]">Phí dịch vụ:</span> {formatCurrency(appointmentPreview.serviceFee)}</p>
                    <p className="sm:col-span-2"><span className="text-[#667892]">BHYT:</span> {appointmentPreview.hasBHYT ? appointmentPreview.healthInsuranceCode || "Có đăng ký BHYT" : "Không sử dụng"}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-sm">
                    <span className="font-medium">Tổng trước giảm trừ</span>
                    <span className="font-semibold text-[#0d4f8b]">{formatCurrency(appointmentPreview.estimatedPrice + appointmentPreview.serviceFee)}</span>
                  </div>
                  {appointmentPreview.invoice ? (
                    <button type="button" onClick={() => {
                      setInvoiceCode(appointmentPreview.invoice?.invoiceCode || "");
                      setAppliedInvoiceCode(appointmentPreview.invoice?.invoiceCode || "");
                      setPage(1);
                      setWorkspaceOpen(false);
                      scrollTo(listRef);
                    }} className="mt-3 text-sm font-semibold text-[#0d4f8b] hover:underline">
                      Mở hóa đơn {appointmentPreview.invoice.invoiceCode}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-[#f2b8b5] bg-[#fff3f2] p-3 text-sm text-[#b3261e]">
                  Không tìm thấy lịch hẹn có mã {appointmentLookupKey}. Hãy kiểm tra lại mã lịch.
                </div>
              )
            ) : null}
            <div className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3">
              <p className="text-sm font-semibold text-[#172033]">Tính BHYT</p>
              <p className="mt-1 text-xs leading-5 text-[#667892]">Nhập phần tiền đủ điều kiện BHYT và mức hưởng, hệ thống sẽ tự tính giảm trừ.</p>
              <label className="mt-3 block">
                <span className="text-sm font-medium text-[#334155]">Số tiền đủ điều kiện</span>
                <input value={formatMoneyInput(insuranceForm.eligibleAmount)} onChange={(event) => setInsuranceForm((current) => ({ ...current, eligibleAmount: parseMoneyInput(event.target.value) }))} placeholder="0" inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Mức hưởng</span>
                  <select value={insuranceForm.coverageRate} onChange={(event) => setInsuranceForm((current) => ({ ...current, coverageRate: event.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                    {insuranceCoverageOptions.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Tuyến/loại</span>
                  <select value={insuranceForm.routeType} onChange={(event) => setInsuranceForm((current) => ({ ...current, routeType: event.target.value as InsuranceRouteType }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                    {insuranceRouteOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-sm font-medium text-[#334155]">Ghi chú BHYT</span>
                <textarea value={insuranceForm.note} onChange={(event) => setInsuranceForm((current) => ({ ...current, note: event.target.value }))} rows={2} placeholder="Ví dụ: áp dụng đúng tuyến theo thẻ BHYT" className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              </label>
              <div className="mt-3 flex justify-between rounded-md bg-white px-3 py-2 text-sm">
                <span className="text-[#667892]">Giảm BHYT dự kiến</span>
                <span className="font-semibold text-[#0d4f8b]">{formatCurrency(createDiscount)}</span>
              </div>
            </div>
            <button disabled={busy || !appointmentReadyForInvoice} className="w-full rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang phát hành..." : "Phát hành hóa đơn"}</button>
          </form>
        </section>

        <section ref={detailRef} className="scroll-mt-24 rounded-md border border-[#dce3ee] bg-white p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-[#55708f]">Chi tiết hóa đơn</p>
                <h3 className="mt-1 text-xl font-semibold">{selected.invoiceCode}</h3>
                <DashboardStatusBadge tone={statusTone[selected.status]} className="mt-3">{statusLabel[selected.status]}</DashboardStatusBadge>
              </div>
              <div className="space-y-3 text-sm">
                <div><p className="text-[#667892]">Mã vạch</p><p className="font-semibold">{selected.barcode}</p></div>
                <div><p className="text-[#667892]">Bệnh nhân</p><p className="font-semibold">{selected.patient.fullName}</p><p>{selected.patient.phone || "-"}</p></div>
                <div><p className="text-[#667892]">Lịch hẹn</p><p className="font-semibold">{selected.appointment.bookingCode}</p><p>{formatDate(selected.appointment.appointmentDate)} {selected.appointment.startTime} - {selected.appointment.endTime}</p></div>
                <div><p className="text-[#667892]">Bác sĩ</p><p className="font-semibold">{doctorName(selected)}</p><p>{selected.appointment.department.name}</p></div>
                <div><p className="text-[#667892]">Dịch vụ</p><p>{selected.appointment.package?.name || "Khám bác sĩ"}</p></div>
                <div>
                  <p className="text-[#667892]">Chi tiết khoản thu</p>
                  <div className="mt-2 space-y-2 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3">
                    {selected.items?.length ? selected.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#172033]">{item.description}</p>
                          {item.quantity > 1 ? <p className="text-xs text-[#667892]">{item.quantity} × {formatCurrency(item.unitPrice)}</p> : null}
                        </div>
                        <p className="shrink-0 font-semibold">{formatCurrency(item.amount)}</p>
                      </div>
                    )) : (
                      <p className="text-[#667892]">Hóa đơn cũ chưa có dữ liệu khoản thu chi tiết.</p>
                    )}
                    <div className="border-t border-[#dce3ee] pt-2">
                      <div className="flex justify-between gap-3"><span>Tổng chi phí</span><span>{formatCurrency(selected.totalAmount)}</span></div>
                      <div className="mt-1 flex justify-between gap-3 text-[#1f7a3a]"><span>Giảm BHYT</span><span>{selected.bhytDiscount > 0 ? `-${formatCurrency(selected.bhytDiscount)}` : formatCurrency(0)}</span></div>
                      <div className="mt-2 flex justify-between gap-3 text-base font-semibold text-[#0d4f8b]"><span>Cần thu</span><span>{formatCurrency(selected.finalAmount)}</span></div>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3">
                  <p className="font-semibold text-[#172033]">Tiêu chuẩn BHYT</p>
                  <p className="mt-2">Phần đủ điều kiện: {formatCurrency(selected.insuranceEligibleAmount)}</p>
                  <p>Mức hưởng: {selected.insuranceCoverageRate}%</p>
                  <p>Tuyến/loại: {selected.insuranceRouteType ? insuranceRouteLabel[selected.insuranceRouteType] : "-"}</p>
                  <p>Quỹ BHYT giảm: {formatCurrency(selected.insuranceDiscountAmount)}</p>
                  {selected.insuranceNote ? <p className="mt-1 text-[#667892]">Ghi chú: {selected.insuranceNote}</p> : null}
                </div>
                {selected.status === "PAID" || selected.status === "REFUNDED" ? (
                  <div className="rounded-md border border-[#b9dfc5] bg-[#f2fbf5] p-3">
                    <p className="font-semibold text-[#195f31]">Biên nhận thanh toán</p>
                    <p className="mt-2">Mã biên nhận: <span className="font-semibold">{selected.invoiceCode}</span></p>
                    <p>Phương thức: {selected.paymentMethod ? paymentLabel[selected.paymentMethod] || selected.paymentMethod : "-"}</p>
                    <p>Thời gian: {selected.paidAt ? formatVietnamDateTime(selected.paidAt) : "-"}</p>
                    <p>Số tiền: <span className="font-semibold">{formatCurrency(selected.finalAmount)}</span></p>
                    {selected.paymentReference ? <p className="break-all">Mã tham chiếu: {selected.paymentReference}</p> : null}
                  </div>
                ) : (
                  <div><p className="text-[#667892]">Thanh toán</p><p>Chưa thanh toán</p></div>
                )}
                <div>
                  <p className="text-[#667892]">Giao dịch trực tuyến gần nhất</p>
                  {selected.paymentTransactions.length ? (
                    <div className="mt-2 space-y-2">
                      {selected.paymentTransactions.map((transaction) => (
                        <div key={transaction.id} className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-[#172033]">{transaction.provider} · {transaction.transactionCode}</p>
                            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${transactionStatusClass[transaction.status]}`}>
                              {transactionStatusLabel[transaction.status]}
                            </span>
                          </div>
                          <p className="mt-1">{formatCurrency(transaction.amount)}</p>
                          <p className="mt-1 text-xs text-[#667892]">
                            Tạo lúc {formatVietnamDateTime(transaction.createdAt)} · Hết hạn {formatVietnamDateTime(transaction.expiredAt)}
                          </p>
                          {transaction.providerOrderId ? (
                            <p className="mt-1 break-all text-xs text-[#667892]">Mã nhà cung cấp: {transaction.providerOrderId}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1">Chưa có giao dịch trực tuyến.</p>
                  )}
                </div>
                {selected.status === "REFUNDED" ? (
                  <div><p className="text-[#667892]">Hoàn tiền</p><p>{selected.refundReason || "-"}</p>{selected.refundReference ? <p>Mã tham chiếu: {selected.refundReference}</p> : null}<p className="text-xs text-[#667892]">{selected.refundedAt ? formatVietnamDateTime(selected.refundedAt) : "-"}</p></div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[#e5ebf3] pt-4">{renderActions(selected)}</div>
              {actionTarget?.invoice.id === selected.id ? (
                <div className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-4">
                  {actionTarget.type === "pay" ? (
                    <>
                      <h4 className="font-semibold">Ghi nhận thu tại quầy</h4>
                      <p className="mt-2 text-sm leading-6 text-[#667892]">Chỉ xác nhận sau khi nhân viên đã thực nhận tiền. MoMo/VNPay được hệ thống tự ghi nhận qua cổng thanh toán.</p>
                      {selected.paymentTransactions.some((transaction) => transaction.status === "PENDING") ? (
                        <p className="mt-3 rounded-md border border-[#f0cf7a] bg-[#fff8e6] p-3 text-sm text-[#73510d]">Có giao dịch trực tuyến đang chờ hoặc chưa đồng bộ hết hạn. Máy chủ sẽ kiểm tra lại và chặn thu tại quầy nếu giao dịch còn hiệu lực để tránh thu hai lần.</p>
                      ) : null}
                      <label className="mt-3 block">
                        <span className="text-sm font-medium text-[#334155]">Phương thức</span>
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as Exclude<PaymentMethod, "MOMO" | "VNPAY">)} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                          {manualPayments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      {payMethod !== "CASH" ? (
                        <label className="mt-3 block">
                          <span className="text-sm font-medium text-[#334155]">Mã tham chiếu {payMethod === "CARD" || payMethod === "BANK_TRANSFER" ? "*" : ""}</span>
                          <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={100} placeholder="Mã giao dịch trên POS hoặc ngân hàng" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                        </label>
                      ) : null}
                      <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void payInvoice()} className="rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xác nhận đã thu</button><button type="button" onClick={() => setActionTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button></div>
                    </>
                  ) : null}
                  {actionTarget.type === "cancel" ? (
                    <>
                      <h4 className="font-semibold text-[#b3261e]">Xác nhận hủy hóa đơn</h4>
                      <p className="mt-2 text-sm text-[#667892]">Hóa đơn chưa thanh toán sẽ chuyển sang trạng thái đã hủy.</p>
                      <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void cancelInvoice()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xác nhận hủy</button><button type="button" onClick={() => setActionTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Giữ hóa đơn</button></div>
                    </>
                  ) : null}
                  {actionTarget.type === "adjust" ? (
                    <>
                      <h4 className="font-semibold">{actionTarget.invoice.status === "CANCELLED" ? "Chỉnh và mở lại hóa đơn" : "Chỉnh giảm BHYT"}</h4>
                      <p className="mt-2 text-sm leading-6 text-[#667892]">Chỉ áp dụng cho hóa đơn chưa thanh toán. Nếu hóa đơn đang bị hủy, lưu điều chỉnh sẽ đưa hóa đơn về trạng thái chưa thanh toán.</p>
                      <label className="mt-3 block">
                        <span className="text-sm font-medium text-[#334155]">Số tiền đủ điều kiện BHYT</span>
                        <input value={formatMoneyInput(adjustInsuranceForm.eligibleAmount)} onChange={(event) => setAdjustInsuranceForm((current) => ({ ...current, eligibleAmount: parseMoneyInput(event.target.value) }))} placeholder="0" inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-medium text-[#334155]">Mức hưởng</span>
                          <select value={adjustInsuranceForm.coverageRate} onChange={(event) => setAdjustInsuranceForm((current) => ({ ...current, coverageRate: event.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                            {insuranceCoverageOptions.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-[#334155]">Tuyến/loại</span>
                          <select value={adjustInsuranceForm.routeType} onChange={(event) => setAdjustInsuranceForm((current) => ({ ...current, routeType: event.target.value as InsuranceRouteType }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                            {insuranceRouteOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="mt-3 block">
                        <span className="text-sm font-medium text-[#334155]">Ghi chú BHYT</span>
                        <textarea value={adjustInsuranceForm.note} onChange={(event) => setAdjustInsuranceForm((current) => ({ ...current, note: event.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      </label>
                      <div className="mt-3 rounded-md border border-[#e5ebf3] bg-white p-3 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-[#667892]">Tổng tiền</span><span className="font-medium">{formatCurrency(actionTarget.invoice.totalAmount)}</span></div>
                        <div className="mt-2 flex justify-between gap-3"><span className="text-[#667892]">Phần đủ điều kiện</span><span className="font-medium">{formatCurrency(toMoneyNumber(adjustInsuranceForm.eligibleAmount))}</span></div>
                        <div className="mt-2 flex justify-between gap-3"><span className="text-[#667892]">Mức hưởng</span><span className="font-medium">{adjustInsuranceForm.coverageRate}%</span></div>
                        <div className="mt-2 flex justify-between gap-3"><span className="text-[#667892]">Giảm BHYT mới</span><span className="font-medium">{formatCurrency(adjustedDiscount)}</span></div>
                        <div className="mt-2 flex justify-between gap-3 border-t border-[#e5ebf3] pt-2"><span className="font-semibold">Cần thu mới</span><span className="font-semibold text-[#0d4f8b]">{formatCurrency(adjustedFinalAmount)}</span></div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button disabled={busy || adjustedDiscount > actionTarget.invoice.totalAmount} onClick={() => void adjustInvoice()} className="rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Lưu điều chỉnh</button>
                        <button type="button" onClick={() => { setActionTarget(null); setAdjustInsuranceForm(defaultInsuranceForm); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Đóng</button>
                      </div>
                    </>
                  ) : null}
                  {actionTarget.type === "refund" ? (
                    <>
                      <h4 className="font-semibold">Xác nhận hoàn tiền</h4>
                      <label className="mt-3 block">
                        <span className="text-sm font-medium text-[#334155]">Lý do hoàn tiền</span>
                        <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={3} placeholder="Ví dụ: bệnh nhân yêu cầu hoàn tiền" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      </label>
                      <label className="mt-3 block">
                        <span className="text-sm font-medium text-[#334155]">Mã tham chiếu hoàn tiền {actionTarget.invoice.paymentMethod === "MOMO" || actionTarget.invoice.paymentMethod === "VNPAY" ? "*" : ""}</span>
                        <input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} maxLength={100} placeholder="Mã hoàn tiền từ quầy hoặc cổng thanh toán" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      </label>
                      {(actionTarget.invoice.paymentMethod === "MOMO" || actionTarget.invoice.paymentMethod === "VNPAY") ? <p className="mt-2 text-xs leading-5 text-[#8a5a00]">Hãy hoàn tiền trên cổng thanh toán trước, sau đó nhập mã tham chiếu để đồng bộ trạng thái hệ thống.</p> : null}
                      <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void refundInvoice()} className="rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Hoàn tiền</button><button type="button" onClick={() => { setActionTarget(null); setRefundReason(""); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button></div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[#55708f]">Chi tiết hóa đơn</p>
              <h3 className="mt-1 text-xl font-semibold">Chọn một hóa đơn</h3>
              <p className="mt-2 text-sm leading-6 text-[#667892]">Bấm vào mã hóa đơn để xem mã vạch, số tiền và thao tác thanh toán.</p>
            </div>
          )}
        </section>
        </div>
        </DashboardWorkspace>
      </aside>
      ) : null}
    </div>
  );
}

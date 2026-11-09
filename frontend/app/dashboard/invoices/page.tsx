"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
  DsKeyValue,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
  type DsColumn,
  type DsTone,
} from "@/components/ds";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { PrintButton, PrintableInvoice } from "@/components/dashboard/printable-documents";
import { ApiError, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardAppointments } from "@/lib/dashboard-appointments-query";
import { useDashboardInvoice, useDashboardInvoices } from "@/lib/dashboard-invoices-query";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { Appointment, InsuranceRouteType, Invoice, InvoiceStatus, PaymentMethod } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Hóa đơn: danh sách bên trái; chọn một hóa đơn (hoặc bấm "Tạo hóa đơn") thì khung bên phải mở cạnh để xem chi tiết,
// áp dụng BHYT, ghi nhận thu, hủy hoặc hoàn tiền.

type InvoiceAction = "pay" | "cancel" | "refund" | "adjust";
type InsuranceForm = {
  eligibleAmount: string;
  coverageRate: string;
  routeType: InsuranceRouteType;
  note: string;
};

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "UNPAID", label: "Chưa thanh toán" },
  { id: "PAID", label: "Đã thanh toán" },
  { id: "CANCELLED", label: "Đã hủy" },
  { id: "REFUNDED", label: "Đã hoàn tiền" },
];

const paymentOptions: { value: "" | PaymentMethod; label: string }[] = [
  { value: "", label: "Mọi phương thức" },
  { value: "CASH", label: "Tiền mặt" },
  { value: "CARD", label: "Thẻ" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "VNPAY", label: "VNPay" },
  { value: "OTHER", label: "Khác" },
];

const manualPayments: { value: Exclude<PaymentMethod, "VNPAY">; label: string }[] = [
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

const defaultInsuranceForm: InsuranceForm = { eligibleAmount: "", coverageRate: "80", routeType: "RIGHT_ROUTE", note: "" };

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

const statusTone: Record<InvoiceStatus, DsTone> = {
  UNPAID: "warn",
  PAID: "good",
  CANCELLED: "bad",
  REFUNDED: "neutral",
};

const paymentLabel: Partial<Record<PaymentMethod, string>> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  VNPAY: "VNPay",
  OTHER: "Khác",
};

const transactionStatusLabel = { PENDING: "Đang chờ", SUCCESS: "Thành công", FAILED: "Thất bại", CANCELLED: "Đã hủy", EXPIRED: "Hết hạn" } as const;
const transactionTone: Record<keyof typeof transactionStatusLabel, DsTone> = {
  PENDING: "warn",
  SUCCESS: "good",
  FAILED: "bad",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

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
  [invoice.appointment.doctor.title, invoice.appointment.doctor.user.fullName].filter(Boolean).join(" ");

const appointmentDoctorName = (appointment: Appointment) =>
  [appointment.doctor.title, appointment.doctor.user.fullName].filter(Boolean).join(" ");

// Nhóm ô nhập tính BHYT dùng chung cho lúc tạo hóa đơn và lúc chỉnh giảm.
function InsuranceFields({
  idPrefix,
  form,
  onChange,
}: {
  idPrefix: string;
  form: InsuranceForm;
  onChange: (next: InsuranceForm) => void;
}) {
  return (
    <>
      <DsField label="Số tiền đủ điều kiện BHYT" htmlFor={`${idPrefix}-eligible`}>
        <DsInput
          id={`${idPrefix}-eligible`}
          inputMode="numeric"
          placeholder="0"
          value={formatMoneyInput(form.eligibleAmount)}
          onChange={(event) => onChange({ ...form, eligibleAmount: parseMoneyInput(event.target.value) })}
        />
      </DsField>
      <div className="ds-grid-fields">
        <DsField label="Mức hưởng" htmlFor={`${idPrefix}-rate`}>
          <DsSelect id={`${idPrefix}-rate`} value={form.coverageRate} onChange={(event) => onChange({ ...form, coverageRate: event.target.value })}>
            {insuranceCoverageOptions.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </DsSelect>
        </DsField>
        <DsField label="Tuyến/loại" htmlFor={`${idPrefix}-route`}>
          <DsSelect id={`${idPrefix}-route`} value={form.routeType} onChange={(event) => onChange({ ...form, routeType: event.target.value as InsuranceRouteType })}>
            {insuranceRouteOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </DsSelect>
        </DsField>
      </div>
      <DsField label="Ghi chú BHYT" htmlFor={`${idPrefix}-note`}>
        <DsTextarea id={`${idPrefix}-note`} rows={2} value={form.note} placeholder="Ví dụ: áp dụng đúng tuyến theo thẻ BHYT" onChange={(event) => onChange({ ...form, note: event.target.value })} />
      </DsField>
    </>
  );
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedSnapshot, setSelected] = useState<Invoice | null>(null);
  const [appointmentId, setAppointmentId] = useState("");
  const [insuranceForm, setInsuranceForm] = useState<InsuranceForm>(defaultInsuranceForm);
  const [actionTarget, setActionTarget] = useState<{ type: InvoiceAction; invoice: Invoice } | null>(null);
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMethod, "VNPAY">>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [adjustInsuranceForm, setAdjustInsuranceForm] = useState<InsuranceForm>(defaultInsuranceForm);
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");

  const canUse = can(user, "invoice.view");
  const canRefund = can(user, "invoice.refund");
  const createDiscount = calculateInsuranceDiscount(insuranceForm);
  const adjustedDiscount = calculateInsuranceDiscount(adjustInsuranceForm);
  const adjustedFinalAmount = actionTarget?.type === "adjust" ? Math.max(actionTarget.invoice.totalAmount - adjustedDiscount, 0) : 0;

  // Gõ đến đâu lọc đến đó; mã lịch khi tạo hóa đơn cũng tự tra sau khi ngừng gõ.
  const term = useDebouncedValue(search.trim());
  const appointmentLookupKey = useDebouncedValue(appointmentId.trim().toUpperCase());

  const query = useMemo(
    () => ({
      status: status || undefined,
      paymentMethod: paymentMethod || undefined,
      q: term || undefined,
      page,
      limit: 20,
    }),
    [page, paymentMethod, status, term],
  );
  const invoicesQuery = useDashboardInvoices(query);
  const appointmentPreviewQuery = useDashboardAppointments(
    { bookingCode: appointmentLookupKey || undefined, page: 1, limit: 1 },
    Boolean(appointmentLookupKey) && creating && canUse,
  );
  const selectedInvoiceQuery = useDashboardInvoice(selectedSnapshot?.id);
  const loading = invoicesQuery.isLoading;
  const invoices = invoicesQuery.data?.items ?? [];
  const pagination = invoicesQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedInvoiceQuery.data ?? selectedSnapshot;
  const appointmentPreview = appointmentPreviewQuery.data?.items[0] ?? null;
  const queryError = invoicesQuery.error || selectedInvoiceQuery.error || appointmentPreviewQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu hóa đơn") : "";
  const visibleError = error || queryErrorMessage;
  const appointmentReadyForInvoice = Boolean(appointmentPreview && appointmentPreview.status === "COMPLETED" && !appointmentPreview.invoice);
  const previewSettled = Boolean(appointmentLookupKey) && appointmentLookupKey === appointmentId.trim().toUpperCase() && !appointmentPreviewQuery.isFetching;

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

  // Mở từ Lịch hẹn: ?appointment=MÃ LỊCH mở sẵn khung tạo hóa đơn; ?invoiceCode=MÃ lọc sẵn hóa đơn đó.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const appointmentCode = params.get("appointment") || params.get("appointmentId") || params.get("bookingCode");
      const initialInvoiceCode = params.get("invoiceCode");

      if (appointmentCode) {
        setCreating(true);
        setSelected(null);
        setAppointmentId(appointmentCode.trim().toUpperCase());
      }
      if (initialInvoiceCode) {
        setSearch(initialInvoiceCode.trim().toUpperCase());
        setPage(1);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const resetActionState = () => {
    setActionTarget(null);
    setRefundReason("");
    setRefundReference("");
    setPaymentReference("");
    setAdjustInsuranceForm(defaultInsuranceForm);
    setPayMethod("CASH");
  };

  const openDetail = (invoice: Invoice) => {
    setCreating(false);
    setSelected(invoice);
    resetActionState();
  };

  const closePane = () => {
    setSelected(null);
    setCreating(false);
    resetActionState();
  };

  const startCreate = () => {
    setSelected(null);
    resetActionState();
    setCreating(true);
  };

  const startAction = (type: InvoiceAction, invoice: Invoice) => {
    setCreating(false);
    setSelected(invoice);
    setActionTarget({ type, invoice });
    setRefundReason("");
    setRefundReference("");
    setPaymentReference("");
    setAdjustInsuranceForm(type === "adjust" ? buildInsuranceForm(invoice) : defaultInsuranceForm);
    setPayMethod("CASH");
    setError("");
    setNotice("");
  };

  const updateSelectedInvoice = async (invoice: Invoice, message: string) => {
    setSelected(invoice);
    resetActionState();
    setNotice(message);
    await invalidateInvoices();
  };

  const createInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUse) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const invoice = await apiRequest<Invoice>(`/dashboard/invoices/appointments/${appointmentId.trim().toUpperCase()}`, {
        method: "POST",
        body: buildInsurancePayload(insuranceForm),
      });
      setCreating(false);
      setSelected(invoice);
      setAppointmentId("");
      setInsuranceForm(defaultInsuranceForm);
      setNotice("Đã phát hành hóa đơn");
      await invalidateInvoices();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const refreshedAppointment = await appointmentPreviewQuery.refetch();
          const existingInvoiceId = refreshedAppointment.data?.items[0]?.invoice?.id;
          await invalidateInvoices();

          if (existingInvoiceId) {
            const existingInvoice = await apiRequest<Invoice>(`/dashboard/invoices/${existingInvoiceId}`);
            setCreating(false);
            setSelected(existingInvoice);
            setNotice("Hóa đơn đã được phát hành ở một thao tác khác. Đã mở hóa đơn hiện có.");
            return;
          }
        } catch (recoveryError) {
          setError(recoveryError instanceof Error ? recoveryError.message : "Hóa đơn đã được phát hành nhưng chưa thể tải lại dữ liệu");
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Không tạo được hóa đơn");
    } finally {
      setBusy(false);
    }
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
        body: { paymentMethod: payMethod, paymentReference: paymentReference.trim() || null },
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
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}/cancel`, { method: "PATCH" });
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
      await updateSelectedInvoice(updated, actionTarget.invoice.status === "CANCELLED" ? "Đã điều chỉnh và mở lại hóa đơn" : "Đã điều chỉnh hóa đơn");
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
    if (actionTarget.invoice.paymentMethod === "VNPAY" && refundReference.trim().length < 3) {
      setError("Vui lòng nhập mã tham chiếu do cổng thanh toán trả về");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}/refund`, {
        method: "PATCH",
        body: { refundReason: refundReason.trim(), refundReference: refundReference.trim() || null },
      });
      await updateSelectedInvoice(updated, "Đã hoàn tiền hóa đơn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tiền được hóa đơn");
    } finally {
      setBusy(false);
    }
  };

  // Hoàn tiền toàn phần tự động qua API VNPay; chỉ dùng cho hóa đơn đã trả bằng VNPay.
  const refundInvoiceViaVnpay = async () => {
    if (!actionTarget || actionTarget.type !== "refund") return;
    if (refundReason.trim().length < 5) {
      setError("Lý do hoàn tiền phải có ít nhất 5 ký tự");
      return;
    }
    if (!window.confirm(`Gửi yêu cầu hoàn ${actionTarget.invoice.finalAmount.toLocaleString("vi-VN")} đ qua VNPay? Thao tác không thể hoàn tác.`)) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(`/dashboard/invoices/${actionTarget.invoice.id}/refund/vnpay`, {
        method: "POST",
        body: { refundReason: refundReason.trim() },
      });
      await updateSelectedInvoice(updated, "Đã gửi yêu cầu hoàn tiền tới VNPay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tiền được qua VNPay");
    } finally {
      setBusy(false);
    }
  };

  if (!canUse) {
    return (
      <>
        <DsPageHeader title="Hóa đơn" description="Phân hệ hóa đơn chỉ dành cho tài khoản được cấp quyền xem hóa đơn" />
        <DsNotice tone="info">Tài khoản của bạn chưa được cấp quyền xem hóa đơn.</DsNotice>
      </>
    );
  }

  const columns: DsColumn<Invoice>[] = [
    {
      key: "invoice",
      header: "Hóa đơn",
      cell: (row) => (
        <div>
          <strong className="ds-mono">{row.invoiceCode}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.appointment.bookingCode}</div>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Người khám",
      cell: (row) => (
        <div>
          <strong>{row.patient.fullName}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.patient.phone || "-"}</div>
        </div>
      ),
    },
    {
      key: "date",
      header: "Ngày khám",
      cell: (row) => (
        <div>
          {formatVietnamDate(row.appointment.appointmentDate)}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.appointment.startTime}</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Số tiền",
      align: "num",
      cell: (row) => (
        <div>
          <strong>{formatCurrency(row.finalAmount)}</strong>
          {row.bhytDiscount > 0 ? <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>BHYT -{formatCurrency(row.bhytDiscount)}</div> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <div>
          <DsStatusPill tone={statusTone[row.status]}>{statusLabel[row.status]}</DsStatusPill>
          {row.paymentMethod ? <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{paymentLabel[row.paymentMethod] || row.paymentMethod}</div> : null}
        </div>
      ),
    },
    {
      key: "action",
      header: "Bước tiếp",
      align: "num",
      cell: (row) =>
        row.status === "UNPAID" ? (
          <DsButton
            onClick={(event) => {
              event.stopPropagation();
              startAction("pay", row);
            }}
          >
            Thu tiền
          </DsButton>
        ) : null,
    },
  ];

  const open = creating || Boolean(selected);

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc hóa đơn">
        <DsToolbar>
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <DsInput
              aria-label="Tìm hóa đơn"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ mã hóa đơn, mã vạch, mã lịch, SĐT hoặc tên"
            />
          </div>
          <div style={{ minWidth: 150, flex: "0 1 190px" }}>
            <DsSelect
              aria-label="Lọc theo phương thức thanh toán"
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(event.target.value);
                setPage(1);
              }}
            >
              {paymentOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </DsSelect>
          </div>
        </DsToolbar>
      </form>
      <DsTabs
        label="Lọc hóa đơn theo trạng thái"
        items={statusTabs}
        value={status}
        onChange={(id) => {
          setStatus(id);
          setPage(1);
        }}
      />
      {open ? (
        invoices.length ? (
          <div role="listbox" aria-label="Danh sách hóa đơn">
            {invoices.map((invoice) => (
              <button key={invoice.id} type="button" role="option" className="ds-listrow" aria-selected={invoice.id === selected?.id} onClick={() => openDetail(invoice)}>
                <span className="ds-listrow__main">
                  <strong>{invoice.patient.fullName}</strong>
                  <small>
                    {invoice.invoiceCode} · {formatCurrency(invoice.finalAmount)}
                  </small>
                </span>
                <DsStatusPill tone={statusTone[invoice.status]}>{statusLabel[invoice.status]}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có hóa đơn phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách hóa đơn"
          columns={columns}
          rows={invoices}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle="Chưa có hóa đơn phù hợp"
          emptyDescription="Đổi bộ lọc hoặc tạo hóa đơn từ một lịch hẹn đã hoàn thành."
          onRowClick={openDetail}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} hóa đơn · trang {pagination.page}/{pagination.totalPages || 1}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <DsButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Trước
          </DsButton>
          <DsButton disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
            Sau
          </DsButton>
        </span>
      </div>
    </DsPanel>
  );

  const createPane = creating ? (
    <DsPane title="Tạo hóa đơn" onClose={closePane}>
      <form onSubmit={createInvoice} style={{ display: "grid", gap: 12 }} aria-label="Tạo hóa đơn">
        <DsField label="Mã lịch hẹn" htmlFor="create-appointment" hint="Lịch phải ở trạng thái hoàn thành khám và chưa có hóa đơn">
          <DsInput id="create-appointment" value={appointmentId} placeholder="Ví dụ: HB-8492" required onChange={(event) => setAppointmentId(event.target.value)} />
        </DsField>
        {appointmentLookupKey && appointmentPreviewQuery.isFetching ? <p className="ds-hint">Đang kiểm tra lịch hẹn...</p> : null}
        {previewSettled ? (
          appointmentPreview ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>{appointmentPreview.patientName}</h3>
                <DsStatusPill tone={appointmentReadyForInvoice ? "good" : "warn"}>
                  {appointmentPreview.invoice ? "Đã có hóa đơn" : appointmentPreview.status === "COMPLETED" ? "Sẵn sàng phát hành" : "Chưa hoàn tất khám"}
                </DsStatusPill>
              </div>
              <div className="ds-card__body">
                <DsKeyValue
                  items={[
                    { label: "Lịch hẹn", value: `${appointmentPreview.bookingCode} · ${appointmentPreview.patientPhone}` },
                    { label: "Dịch vụ", value: appointmentPreview.package?.name || appointmentPreview.department.name },
                    { label: "Bác sĩ", value: appointmentDoctorName(appointmentPreview) },
                    { label: "Giá khám", value: formatCurrency(appointmentPreview.estimatedPrice) },
                    { label: "Phí dịch vụ", value: formatCurrency(appointmentPreview.serviceFee) },
                    { label: "BHYT", value: appointmentPreview.hasBHYT ? appointmentPreview.healthInsuranceCode || "Có đăng ký BHYT" : "Không sử dụng" },
                    { label: "Tổng trước giảm trừ", value: <strong>{formatCurrency(appointmentPreview.estimatedPrice + appointmentPreview.serviceFee)}</strong> },
                  ]}
                />
                {appointmentPreview.invoice ? (
                  <DsButton
                    onClick={() => {
                      setCreating(false);
                      setSearch(appointmentPreview.invoice?.invoiceCode || "");
                      setPage(1);
                    }}
                  >
                    Mở hóa đơn {appointmentPreview.invoice.invoiceCode}
                  </DsButton>
                ) : null}
              </div>
            </div>
          ) : (
            <DsNotice tone="bad">Không tìm thấy lịch hẹn có mã {appointmentLookupKey}. Hãy kiểm tra lại mã lịch.</DsNotice>
          )
        ) : null}
        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Tính BHYT</h3>
          </div>
          <div className="ds-card__body">
            <p className="ds-hint" style={{ margin: 0 }}>
              Nhập phần tiền đủ điều kiện BHYT và mức hưởng, hệ thống tự tính giảm trừ.
            </p>
            <InsuranceFields idPrefix="create" form={insuranceForm} onChange={setInsuranceForm} />
            <DsKeyValue items={[{ label: "Giảm BHYT dự kiến", value: <strong>{formatCurrency(createDiscount)}</strong> }]} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
          {!appointmentReadyForInvoice ? <span className="ds-hint">Cần một lịch hẹn đã hoàn thành khám và chưa có hóa đơn.</span> : null}
          <DsButton onClick={closePane}>Hủy</DsButton>
          <DsButton type="submit" variant="primary" disabled={busy || !appointmentReadyForInvoice}>
            {busy ? "Đang phát hành..." : "Phát hành hóa đơn"}
          </DsButton>
        </div>
      </form>
    </DsPane>
  ) : null;

  const activeAction = selected && actionTarget?.invoice.id === selected.id ? actionTarget : null;

  const detailPane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.invoiceCode} · ${selected.patient.fullName}`}
      badge={<DsStatusPill tone={statusTone[selected.status]}>{statusLabel[selected.status]}</DsStatusPill>}
      onClose={closePane}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {selected.barcode} · {selected.patient.phone || "-"} · {selected.appointment.bookingCode} · {formatVietnamDate(selected.appointment.appointmentDate)} {selected.appointment.startTime} -{" "}
        {selected.appointment.endTime} · {doctorName(selected)} · {selected.appointment.department.name} · {selected.appointment.package?.name || "Khám bác sĩ"}
      </div>

      <div className="ds-savebar" style={{ borderTop: 0, position: "static", paddingTop: 12 }}>
        {selected.status === "UNPAID" ? (
          <>
            <DsButton variant="primary" disabled={busy} onClick={() => startAction("pay", selected)}>
              Ghi nhận thu tại quầy
            </DsButton>
            <DsButton disabled={busy} onClick={() => startAction("adjust", selected)}>
              Chỉnh giảm BHYT
            </DsButton>
          </>
        ) : null}
        {selected.status === "CANCELLED" ? (
          <DsButton disabled={busy} onClick={() => startAction("adjust", selected)}>
            Chỉnh và mở lại
          </DsButton>
        ) : null}
        {canRefund && selected.status === "PAID" ? (
          <DsButton disabled={busy} onClick={() => startAction("refund", selected)}>
            Hoàn tiền
          </DsButton>
        ) : null}
        <PrintButton label="In hóa đơn" />
        <PrintableInvoice invoice={selected} />
        <span style={{ flex: 1 }} />
        {selected.status === "UNPAID" ? (
          <DsButton variant="ghost" disabled={busy} onClick={() => startAction("cancel", selected)}>
            Hủy hóa đơn
          </DsButton>
        ) : null}
      </div>

      <div className="ds-editor">
        <div className="ds-editor__col">
          {activeAction?.type === "pay" ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Ghi nhận thu tại quầy</h3>
              </div>
              <div className="ds-card__body">
                <p className="ds-hint" style={{ margin: 0 }}>
                  Chỉ xác nhận sau khi nhân viên đã thực nhận tiền. VNPay được hệ thống tự ghi nhận qua cổng thanh toán.
                </p>
                {selected.paymentTransactions.some((transaction) => transaction.status === "PENDING") ? (
                  <DsNotice tone="warn">
                    Có giao dịch trực tuyến đang chờ hoặc chưa đồng bộ hết hạn. Máy chủ sẽ kiểm tra lại và chặn thu tại quầy nếu giao dịch còn hiệu lực để tránh thu hai lần.
                  </DsNotice>
                ) : null}
                <DsField label="Phương thức" htmlFor="pay-method">
                  <DsSelect id="pay-method" value={payMethod} onChange={(event) => setPayMethod(event.target.value as Exclude<PaymentMethod, "VNPAY">)}>
                    {manualPayments.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </DsSelect>
                </DsField>
                {payMethod !== "CASH" ? (
                  <DsField label="Mã tham chiếu" htmlFor="pay-reference" required={payMethod === "CARD" || payMethod === "BANK_TRANSFER"}>
                    <DsInput id="pay-reference" value={paymentReference} maxLength={100} placeholder="Mã giao dịch trên POS hoặc ngân hàng" onChange={(event) => setPaymentReference(event.target.value)} />
                  </DsField>
                ) : null}
                <DsKeyValue items={[{ label: "Số tiền cần thu", value: <strong>{formatCurrency(selected.finalAmount)}</strong> }]} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => setActionTarget(null)}>Đóng</DsButton>
                  <DsButton variant="primary" disabled={busy} onClick={() => void payInvoice()}>
                    Xác nhận đã thu
                  </DsButton>
                </div>
              </div>
            </div>
          ) : null}

          {activeAction?.type === "cancel" ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Xác nhận hủy hóa đơn</h3>
              </div>
              <div className="ds-card__body">
                <p className="ds-hint" style={{ margin: 0 }}>
                  Hóa đơn chưa thanh toán sẽ chuyển sang trạng thái đã hủy; có thể chỉnh và mở lại sau.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => setActionTarget(null)}>Giữ hóa đơn</DsButton>
                  <DsButton variant="danger" disabled={busy} onClick={() => void cancelInvoice()}>
                    Xác nhận hủy
                  </DsButton>
                </div>
              </div>
            </div>
          ) : null}

          {activeAction?.type === "adjust" ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>{activeAction.invoice.status === "CANCELLED" ? "Chỉnh và mở lại hóa đơn" : "Chỉnh giảm BHYT"}</h3>
              </div>
              <div className="ds-card__body">
                <p className="ds-hint" style={{ margin: 0 }}>
                  Chỉ áp dụng cho hóa đơn chưa thanh toán. Nếu hóa đơn đang bị hủy, lưu điều chỉnh sẽ đưa hóa đơn về trạng thái chưa thanh toán.
                </p>
                <InsuranceFields idPrefix="adjust" form={adjustInsuranceForm} onChange={setAdjustInsuranceForm} />
                <DsKeyValue
                  items={[
                    { label: "Tổng tiền", value: formatCurrency(activeAction.invoice.totalAmount) },
                    { label: "Giảm BHYT mới", value: formatCurrency(adjustedDiscount) },
                    { label: "Cần thu mới", value: <strong>{formatCurrency(adjustedFinalAmount)}</strong> },
                  ]}
                />
                {adjustedDiscount > activeAction.invoice.totalAmount ? <DsNotice tone="bad">Giảm trừ BHYT không được lớn hơn tổng tiền.</DsNotice> : null}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={resetActionState}>Đóng</DsButton>
                  <DsButton variant="primary" disabled={busy || adjustedDiscount > activeAction.invoice.totalAmount} onClick={() => void adjustInvoice()}>
                    Lưu điều chỉnh
                  </DsButton>
                </div>
              </div>
            </div>
          ) : null}

          {activeAction?.type === "refund" ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Xác nhận hoàn tiền</h3>
              </div>
              <div className="ds-card__body">
                <DsField label="Lý do hoàn tiền" htmlFor="refund-reason" required hint="Ít nhất 5 ký tự">
                  <DsTextarea id="refund-reason" rows={3} value={refundReason} placeholder="Ví dụ: người khám yêu cầu hoàn tiền" onChange={(event) => setRefundReason(event.target.value)} />
                </DsField>
                <DsField label="Mã tham chiếu hoàn tiền" htmlFor="refund-reference" required={activeAction.invoice.paymentMethod === "VNPAY"}>
                  <DsInput id="refund-reference" value={refundReference} maxLength={100} placeholder="Mã hoàn tiền từ quầy hoặc cổng thanh toán" onChange={(event) => setRefundReference(event.target.value)} />
                </DsField>
                {activeAction.invoice.paymentMethod === "VNPAY" ? (
                  <DsNotice tone="warn">
                    Dùng nút &quot;Hoàn tự động qua VNPay&quot; để hệ thống gửi yêu cầu hoàn toàn phần tới VNPay. Nếu đã hoàn trực tiếp trên cổng VNPay (hoặc hệ thống báo chưa xác nhận được kết quả), hãy nhập mã tham chiếu rồi bấm &quot;Hoàn tiền&quot; để chỉ đồng bộ trạng thái.
                  </DsNotice>
                ) : null}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <DsButton onClick={() => { setActionTarget(null); setRefundReason(""); }}>Đóng</DsButton>
                  {activeAction.invoice.paymentMethod === "VNPAY" ? (
                    <DsButton variant="danger" disabled={busy || refundReason.trim().length < 5} onClick={() => void refundInvoiceViaVnpay()}>
                      Hoàn tự động qua VNPay
                    </DsButton>
                  ) : null}
                  <DsButton variant="primary" disabled={busy} onClick={() => void refundInvoice()}>
                    Hoàn tiền
                  </DsButton>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Chi tiết khoản thu</h3>
            </div>
            <div className="ds-card__body">
              {selected.items?.length ? (
                selected.items.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{item.description}</strong>
                      {item.quantity > 1 ? (
                        <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      ) : null}
                    </div>
                    <strong style={{ flex: "none" }}>{formatCurrency(item.amount)}</strong>
                  </div>
                ))
              ) : (
                <p className="ds-hint" style={{ margin: 0 }}>
                  Hóa đơn cũ chưa có dữ liệu khoản thu chi tiết.
                </p>
              )}
              <DsKeyValue
                items={[
                  { label: "Tổng chi phí", value: formatCurrency(selected.totalAmount) },
                  { label: "Giảm BHYT", value: selected.bhytDiscount > 0 ? `- ${formatCurrency(selected.bhytDiscount)}` : formatCurrency(0) },
                  { label: "Cần thu", value: <strong>{formatCurrency(selected.finalAmount)}</strong> },
                ]}
              />
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Tiêu chuẩn BHYT</h3>
            </div>
            <div className="ds-card__body">
              <DsKeyValue
                items={[
                  { label: "Phần đủ điều kiện", value: formatCurrency(selected.insuranceEligibleAmount) },
                  { label: "Mức hưởng", value: `${selected.insuranceCoverageRate}%` },
                  { label: "Tuyến/loại", value: selected.insuranceRouteType ? insuranceRouteLabel[selected.insuranceRouteType] : "-" },
                  { label: "Quỹ BHYT giảm", value: formatCurrency(selected.insuranceDiscountAmount) },
                ]}
              />
              {selected.insuranceNote ? <p className="ds-hint" style={{ margin: 0 }}>Ghi chú: {selected.insuranceNote}</p> : null}
            </div>
          </div>
        </div>

        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Thanh toán</h3>
            </div>
            <div className="ds-card__body">
              {selected.status === "PAID" || selected.status === "REFUNDED" ? (
                <DsKeyValue
                  items={[
                    { label: "Mã biên nhận", value: selected.invoiceCode },
                    { label: "Phương thức", value: selected.paymentMethod ? paymentLabel[selected.paymentMethod] || selected.paymentMethod : "-" },
                    { label: "Thời gian", value: selected.paidAt ? formatVietnamDateTime(selected.paidAt) : "-" },
                    { label: "Số tiền", value: <strong>{formatCurrency(selected.finalAmount)}</strong> },
                    ...(selected.paymentReference ? [{ label: "Mã tham chiếu", value: selected.paymentReference }] : []),
                  ]}
                />
              ) : (
                <p style={{ margin: 0, color: "var(--ds-muted)" }}>Chưa thanh toán.</p>
              )}
              {selected.status === "REFUNDED" ? (
                <DsKeyValue
                  items={[
                    { label: "Lý do hoàn", value: selected.refundReason || "-" },
                    ...(selected.refundReference ? [{ label: "Tham chiếu hoàn", value: selected.refundReference }] : []),
                    { label: "Hoàn lúc", value: selected.refundedAt ? formatVietnamDateTime(selected.refundedAt) : "-" },
                  ]}
                />
              ) : null}
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Giao dịch trực tuyến</h3>
            </div>
            {selected.paymentTransactions.length ? (
              selected.paymentTransactions.map((transaction) => (
                <div key={transaction.id} className="ds-labrow">
                  <div className="ds-labrow__main">
                    <strong>
                      {transaction.provider} · {transaction.transactionCode}
                    </strong>
                    <small>{formatCurrency(transaction.amount)}</small>
                    <small>
                      Tạo lúc {formatVietnamDateTime(transaction.createdAt)} · hết hạn {formatVietnamDateTime(transaction.expiredAt)}
                    </small>
                    {transaction.providerOrderId ? <small>Mã nhà cung cấp: {transaction.providerOrderId}</small> : null}
                  </div>
                  <DsStatusPill tone={transactionTone[transaction.status]}>{transactionStatusLabel[transaction.status]}</DsStatusPill>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có giao dịch trực tuyến.</p>
            )}
          </div>
        </div>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Hóa đơn"
        description="Tạo hóa đơn từ lịch hẹn hoàn thành, áp dụng BHYT và kiểm soát thanh toán, hủy hoặc hoàn tiền"
        actions={
          <>
            <ExportCsvButton ds path="/dashboard/invoices/export" fallbackName="hoa-don.csv" params={{ status: status || undefined }} />
            <DsButton variant="primary" onClick={startCreate}>
              <Plus aria-hidden="true" />
              Tạo hóa đơn
            </DsButton>
          </>
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit wide list={list} pane={detailPane ?? createPane} />
    </>
  );
}

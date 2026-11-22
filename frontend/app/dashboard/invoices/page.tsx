"use client";

import { useEffect, useMemo, useState } from "react";
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
  useActionToast,
  useConfirm,
  DsDialog,
} from "@/components/ds";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { MedicineRefundPanel } from "@/components/dashboard/medicine-refund-panel";
import { SupplementPanel } from "@/components/dashboard/supplement-panel";
import {
  PrintButton,
  PrintableInvoice,
} from "@/components/dashboard/printable-documents";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDashboardInvoice,
  useDashboardInvoices,
} from "@/lib/dashboard-invoices-query";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type {
  Invoice,
  PaymentMethod,
} from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  type InvoiceAction,
  type InsuranceForm,
  statusTabs,
  paymentOptions,
  manualPayments,
  defaultInsuranceForm,
  insuranceRouteLabel,
  statusLabel,
  statusTone,
  paymentLabel,
  transactionStatusLabel,
  transactionTone,
  calculateInsuranceDiscount,
  buildInsuranceForm,
  buildInsurancePayload,
  doctorName,
} from "./invoice-model";
import { CreateInvoiceDialog } from "./create-invoice-dialog";
import { InsuranceFields } from "./insurance-fields";

// Hóa đơn: danh sách bên trái; chọn một hóa đơn (hoặc bấm "Tạo hóa đơn") thì khung bên phải mở cạnh để xem chi tiết,
// áp dụng BHYT, ghi nhận thu, hủy hoặc hoàn tiền.

export default function InvoicesPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedSnapshot, setSelected] = useState<Invoice | null>(null);
  const [initialCode, setInitialCode] = useState("");
  const [actionTarget, setActionTarget] = useState<{
    type: InvoiceAction;
    invoice: Invoice;
  } | null>(null);
  const [payMethod, setPayMethod] =
    useState<Exclude<PaymentMethod, "VNPAY">>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [adjustInsuranceForm, setAdjustInsuranceForm] =
    useState<InsuranceForm>(defaultInsuranceForm);
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");

  const canUse = can(user, "invoice.view");
  const canRefund = can(user, "invoice.refund");
  const adjustedDiscount = calculateInsuranceDiscount(adjustInsuranceForm);
  const adjustedFinalAmount =
    actionTarget?.type === "adjust"
      ? Math.max(actionTarget.invoice.totalAmount - adjustedDiscount, 0)
      : 0;

  // Gõ đến đâu lọc đến đó.
  const term = useDebouncedValue(search.trim());

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
  const selectedInvoiceQuery = useDashboardInvoice(selectedSnapshot?.id);
  const loading = invoicesQuery.isLoading;
  const invoices = invoicesQuery.data?.items ?? [];
  const pagination = invoicesQuery.data?.pagination ?? {
    page,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
  const selected = selectedInvoiceQuery.data ?? selectedSnapshot;
  const queryError = invoicesQuery.error || selectedInvoiceQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu hóa đơn"
    : "";
  // Kết quả thao tác hiện thành thông báo nổi ngay chỗ đang làm việc (không nằm ở đầu trang).
  useActionToast({
    notice,
    error,
    clear: () => {
      setNotice("");
      setError("");
    },
  });
  const invalidateInvoices = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInvoices }),
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "appointments"],
      }),
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
      const appointmentCode =
        params.get("appointment") ||
        params.get("appointmentId") ||
        params.get("bookingCode");
      const initialInvoiceCode = params.get("invoiceCode");

      if (appointmentCode) {
        setCreating(true);
        setSelected(null);
        setInitialCode(appointmentCode.trim().toUpperCase());
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
    setInitialCode("");
    setCreating(true);
  };

  const startAction = (type: InvoiceAction, invoice: Invoice) => {
    setCreating(false);
    setSelected(invoice);
    setActionTarget({ type, invoice });
    setRefundReason("");
    setRefundReference("");
    setPaymentReference("");
    setAdjustInsuranceForm(
      type === "adjust" ? buildInsuranceForm(invoice) : defaultInsuranceForm,
    );
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

  // Thu tiền mặt ngay từ dòng danh sách: bấm lần một để chọn, bấm lần hai (trong 4 giây) để xác nhận, tránh thu nhầm.
  const [quickPayId, setQuickPayId] = useState("");
  const quickPayCash = async (invoice: Invoice) => {
    if (quickPayId !== invoice.id) {
      setQuickPayId(invoice.id);
      window.setTimeout(
        () =>
          setQuickPayId((current) => (current === invoice.id ? "" : current)),
        4000,
      );
      return;
    }
    setQuickPayId("");
    setBusy(true);
    setBusyId(invoice.id);
    setError("");
    setNotice("");
    try {
      await apiRequest<Invoice>(`/dashboard/invoices/${invoice.id}/pay`, {
        method: "PATCH",
        body: { paymentMethod: "CASH" },
      });
      setNotice(
        `Đã thu ${formatCurrency(invoice.finalAmount)} tiền mặt · ${invoice.invoiceCode}`,
      );
      await invalidateInvoices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thanh toán được hóa đơn",
      );
    } finally {
      setBusy(false);
      setBusyId("");
    }
  };

  const payInvoice = async () => {
    if (!actionTarget || actionTarget.type !== "pay") return;
    if (
      ["CARD", "BANK_TRANSFER"].includes(payMethod) &&
      paymentReference.trim().length < 3
    ) {
      setError("Vui lòng nhập mã tham chiếu của giao dịch");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(
        `/dashboard/invoices/${actionTarget.invoice.id}/pay`,
        {
          method: "PATCH",
          body: {
            paymentMethod: payMethod,
            paymentReference: paymentReference.trim() || null,
          },
        },
      );
      await updateSelectedInvoice(updated, "Đã thanh toán hóa đơn");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thanh toán được hóa đơn",
      );
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
      const updated = await apiRequest<Invoice>(
        `/dashboard/invoices/${actionTarget.invoice.id}/cancel`,
        { method: "PATCH" },
      );
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
      const updated = await apiRequest<Invoice>(
        `/dashboard/invoices/${actionTarget.invoice.id}`,
        {
          method: "PATCH",
          body: buildInsurancePayload(adjustInsuranceForm),
        },
      );
      await updateSelectedInvoice(
        updated,
        actionTarget.invoice.status === "CANCELLED"
          ? "Đã điều chỉnh và mở lại hóa đơn"
          : "Đã điều chỉnh hóa đơn",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không điều chỉnh được hóa đơn",
      );
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
      actionTarget.invoice.paymentMethod === "VNPAY" &&
      refundReference.trim().length < 3
    ) {
      setError("Vui lòng nhập mã tham chiếu do cổng thanh toán trả về");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(
        `/dashboard/invoices/${actionTarget.invoice.id}/refund`,
        {
          method: "PATCH",
          body: {
            refundReason: refundReason.trim(),
            refundReference: refundReference.trim() || null,
          },
        },
      );
      await updateSelectedInvoice(updated, "Đã hoàn tiền hóa đơn");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không hoàn tiền được hóa đơn",
      );
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
    const agreed = await confirm({
      title: `Hoàn ${actionTarget.invoice.finalAmount.toLocaleString("vi-VN")} đ qua VNPay?`,
      message:
        "Yêu cầu hoàn tiền được gửi ngay tới VNPay. Thao tác không thể hoàn tác.",
      confirmLabel: "Gửi yêu cầu hoàn",
      tone: "danger",
    });
    if (!agreed) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Invoice>(
        `/dashboard/invoices/${actionTarget.invoice.id}/refund/vnpay`,
        {
          method: "POST",
          body: { refundReason: refundReason.trim() },
        },
      );
      await updateSelectedInvoice(
        updated,
        "Đã gửi yêu cầu hoàn tiền tới VNPay",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không hoàn tiền được qua VNPay",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canUse) {
    return (
      <>
        <DsPageHeader
          title="Hóa đơn"
          description="Phân hệ hóa đơn chỉ dành cho tài khoản được cấp quyền xem hóa đơn"
        />
        <DsNotice tone="info">
          Tài khoản của bạn chưa được cấp quyền xem hóa đơn.
        </DsNotice>
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
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.appointment.bookingCode}
          </div>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Người khám",
      cell: (row) => (
        <div>
          <strong>{row.patient.fullName}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.patient.phone || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "date",
      header: "Ngày khám",
      cell: (row) => (
        <div>
          {formatVietnamDate(row.appointment.appointmentDate)}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.appointment.startTime}
          </div>
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
          {row.bhytDiscount > 0 ? (
            <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
              BHYT -{formatCurrency(row.bhytDiscount)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <div>
          <DsStatusPill tone={statusTone[row.status]}>
            {statusLabel[row.status]}
          </DsStatusPill>
          {row.paymentMethod ? (
            <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
              {paymentLabel[row.paymentMethod] || row.paymentMethod}
            </div>
          ) : null}
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
            variant={quickPayId === row.id ? "primary" : "default"}
            disabled={busy}
            loading={busy && busyId === row.id}
            onClick={(event) => {
              event.stopPropagation();
              void quickPayCash(row);
            }}
          >
            {quickPayId === row.id
              ? `Xác nhận thu ${formatCurrency(row.finalAmount)}`
              : "Thu tiền mặt"}
          </DsButton>
        ) : null,
    },
  ];

  const open = creating || Boolean(selected);

  const list = (
    <DsPanel flush>
      <form
        onSubmit={(event) => event.preventDefault()}
        aria-label="Lọc hóa đơn"
      >
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
              <button
                key={invoice.id}
                type="button"
                role="option"
                className="ds-listrow"
                aria-selected={invoice.id === selected?.id}
                onClick={() => openDetail(invoice)}
              >
                <span className="ds-listrow__main">
                  <strong>{invoice.patient.fullName}</strong>
                  <small>
                    {invoice.invoiceCode} ·{" "}
                    {formatCurrency(invoice.finalAmount)}
                  </small>
                </span>
                <DsStatusPill tone={statusTone[invoice.status]}>
                  {statusLabel[invoice.status]}
                </DsStatusPill>
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
          emptyTitle={
            status === "UNPAID"
              ? "Không có hóa đơn nào đang chờ thu"
              : "Chưa có hóa đơn phù hợp"
          }
          emptyDescription={
            status === "UNPAID"
              ? "Hóa đơn tự tạo khi bác sĩ hoàn thành khám và hiện ở đây cho đến khi được thu."
              : "Đổi bộ lọc để xem hóa đơn khác."
          }
          onRowClick={openDetail}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} hóa đơn · trang {pagination.page}/
          {pagination.totalPages || 1}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <DsButton
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Trước
          </DsButton>
          <DsButton
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </DsButton>
        </span>
      </div>
    </DsPanel>
  );

  const activeAction =
    selected && actionTarget?.invoice.id === selected.id ? actionTarget : null;

  const detailPane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.invoiceCode} · ${selected.patient.fullName}`}
      badge={
        <DsStatusPill tone={statusTone[selected.status]}>
          {statusLabel[selected.status]}
        </DsStatusPill>
      }
      onClose={closePane}
    >
      <div
        style={{
          padding: "12px 16px 0",
          color: "var(--ds-muted)",
          fontSize: 13,
        }}
      >
        {selected.barcode} · {selected.patient.phone || "-"} ·{" "}
        {selected.appointment.bookingCode} ·{" "}
        {formatVietnamDate(selected.appointment.appointmentDate)}{" "}
        {selected.appointment.startTime} - {selected.appointment.endTime} ·{" "}
        {doctorName(selected)} · {selected.appointment.department.name} ·{" "}
        {selected.appointment.package?.name || "Khám bác sĩ"}
      </div>

      <div
        className="ds-savebar"
        style={{ borderTop: 0, position: "static", paddingTop: 12 }}
      >
        {selected.status === "UNPAID" ? (
          <>
            <DsButton
              variant="primary"
              loading={busy}
              onClick={() => startAction("pay", selected)}
            >
              Ghi nhận thu tại quầy
            </DsButton>
            <DsButton
              loading={busy}
              onClick={() => startAction("adjust", selected)}
            >
              Chỉnh giảm BHYT
            </DsButton>
          </>
        ) : null}
        {selected.status === "CANCELLED" ? (
          <DsButton
            loading={busy}
            onClick={() => startAction("adjust", selected)}
          >
            Chỉnh và mở lại
          </DsButton>
        ) : null}
        {canRefund && selected.status === "PAID" ? (
          <DsButton
            loading={busy}
            onClick={() => startAction("refund", selected)}
          >
            Hoàn tiền
          </DsButton>
        ) : null}
        <PrintButton label="In hóa đơn" />
        <PrintableInvoice invoice={selected} />
        <span style={{ flex: 1 }} />
        {selected.status === "UNPAID" ? (
          <DsButton
            variant="ghost"
            loading={busy}
            onClick={() => startAction("cancel", selected)}
          >
            Hủy hóa đơn
          </DsButton>
        ) : null}
      </div>

      <div className="ds-editor">
        <div className="ds-editor__col">
          {activeAction?.type === "pay" ? (
            <DsDialog
              open
              onOpenChange={(open) => {
                if (!open) setActionTarget(null);
              }}
              title="Ghi nhận thu tại quầy"
              description="Chỉ xác nhận sau khi nhân viên đã thực nhận tiền. VNPay được hệ thống tự ghi nhận qua cổng thanh toán."
              size="md"
              footer={
                <>
                  <DsButton onClick={() => setActionTarget(null)}>
                    Đóng
                  </DsButton>
                  <DsButton
                    variant="primary"
                    loading={busy}
                    onClick={() => void payInvoice()}
                  >
                    Xác nhận đã thu
                  </DsButton>
                </>
              }
            >
              {selected.paymentTransactions.some(
                (transaction) => transaction.status === "PENDING",
              ) ? (
                <DsNotice tone="warn">
                  Có giao dịch trực tuyến đang chờ hoặc chưa đồng bộ hết hạn.
                  Máy chủ sẽ kiểm tra lại và chặn thu tại quầy nếu giao dịch còn
                  hiệu lực để tránh thu hai lần.
                </DsNotice>
              ) : null}
              <DsField label="Phương thức" htmlFor="pay-method">
                <DsSelect
                  id="pay-method"
                  value={payMethod}
                  onChange={(event) =>
                    setPayMethod(
                      event.target.value as Exclude<PaymentMethod, "VNPAY">,
                    )
                  }
                >
                  {manualPayments.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </DsSelect>
              </DsField>
              {payMethod !== "CASH" ? (
                <DsField
                  label="Mã tham chiếu"
                  htmlFor="pay-reference"
                  required={
                    payMethod === "CARD" || payMethod === "BANK_TRANSFER"
                  }
                >
                  <DsInput
                    id="pay-reference"
                    value={paymentReference}
                    maxLength={100}
                    placeholder="Mã giao dịch trên POS hoặc ngân hàng"
                    onChange={(event) =>
                      setPaymentReference(event.target.value)
                    }
                  />
                </DsField>
              ) : null}
              <DsKeyValue
                items={[
                  {
                    label: "Số tiền cần thu",
                    value: (
                      <strong>{formatCurrency(selected.finalAmount)}</strong>
                    ),
                  },
                ]}
              />
            </DsDialog>
          ) : null}

          {activeAction?.type === "cancel" ? (
            <DsDialog
              open
              onOpenChange={(open) => {
                if (!open) setActionTarget(null);
              }}
              title="Xác nhận hủy hóa đơn"
              description="Hóa đơn chưa thanh toán sẽ chuyển sang trạng thái đã hủy; có thể chỉnh và mở lại sau."
              size="sm"
              footer={
                <>
                  <DsButton onClick={() => setActionTarget(null)}>
                    Giữ hóa đơn
                  </DsButton>
                  <DsButton
                    variant="danger"
                    loading={busy}
                    onClick={() => void cancelInvoice()}
                  >
                    Xác nhận hủy
                  </DsButton>
                </>
              }
            ></DsDialog>
          ) : null}

          {activeAction?.type === "adjust" ? (
            <DsDialog
              open
              onOpenChange={(open) => {
                if (!open) resetActionState();
              }}
              title={
                activeAction.invoice.status === "CANCELLED"
                  ? "Chỉnh và mở lại hóa đơn"
                  : "Chỉnh giảm BHYT"
              }
              description="Chỉ áp dụng cho hóa đơn chưa thanh toán. Nếu hóa đơn đang bị hủy, lưu điều chỉnh sẽ đưa hóa đơn về trạng thái chưa thanh toán."
              size="lg"
              footer={
                <>
                  <DsButton onClick={resetActionState}>Đóng</DsButton>
                  <DsButton
                    variant="primary"
                    disabled={
                      busy ||
                      adjustedDiscount > activeAction.invoice.totalAmount
                    }
                    onClick={() => void adjustInvoice()}
                  >
                    Lưu điều chỉnh
                  </DsButton>
                </>
              }
            >
              <InsuranceFields
                idPrefix="adjust"
                form={adjustInsuranceForm}
                onChange={setAdjustInsuranceForm}
              />
              <DsKeyValue
                items={[
                  {
                    label: "Tổng tiền",
                    value: formatCurrency(activeAction.invoice.totalAmount),
                  },
                  {
                    label: "Giảm BHYT mới",
                    value: formatCurrency(adjustedDiscount),
                  },
                  {
                    label: "Cần thu mới",
                    value: (
                      <strong>{formatCurrency(adjustedFinalAmount)}</strong>
                    ),
                  },
                ]}
              />
              {adjustedDiscount > activeAction.invoice.totalAmount ? (
                <DsNotice tone="bad">
                  Giảm trừ BHYT không được lớn hơn tổng tiền.
                </DsNotice>
              ) : null}
            </DsDialog>
          ) : null}

          {activeAction?.type === "refund" ? (
            <DsDialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setActionTarget(null);
                  setRefundReason("");
                }
              }}
              title="Xác nhận hoàn tiền"
              size="md"
              footer={
                <>
                  <DsButton
                    onClick={() => {
                      setActionTarget(null);
                      setRefundReason("");
                    }}
                  >
                    Đóng
                  </DsButton>
                  {activeAction.invoice.paymentMethod === "VNPAY" ? (
                    <DsButton
                      variant="danger"
                      disabled={busy || refundReason.trim().length < 5}
                      onClick={() => void refundInvoiceViaVnpay()}
                    >
                      Hoàn tự động qua VNPay
                    </DsButton>
                  ) : null}
                  <DsButton
                    variant="primary"
                    loading={busy}
                    onClick={() => void refundInvoice()}
                  >
                    Hoàn tiền
                  </DsButton>
                </>
              }
            >
              <DsField
                label="Lý do hoàn tiền"
                htmlFor="refund-reason"
                required
                hint="Ít nhất 5 ký tự"
              >
                <DsTextarea
                  id="refund-reason"
                  rows={3}
                  value={refundReason}
                  placeholder="Ví dụ: người khám yêu cầu hoàn tiền"
                  onChange={(event) => setRefundReason(event.target.value)}
                />
              </DsField>
              <DsField
                label="Mã tham chiếu hoàn tiền"
                htmlFor="refund-reference"
                required={activeAction.invoice.paymentMethod === "VNPAY"}
              >
                <DsInput
                  id="refund-reference"
                  value={refundReference}
                  maxLength={100}
                  placeholder="Mã hoàn tiền từ quầy hoặc cổng thanh toán"
                  onChange={(event) => setRefundReference(event.target.value)}
                />
              </DsField>
              {activeAction.invoice.paymentMethod === "VNPAY" ? (
                <DsNotice tone="warn">
                  Dùng nút &quot;Hoàn tự động qua VNPay&quot; để hệ thống gửi
                  yêu cầu hoàn toàn phần tới VNPay. Nếu đã hoàn trực tiếp trên
                  cổng VNPay (hoặc hệ thống báo chưa xác nhận được kết quả), hãy
                  nhập mã tham chiếu rồi bấm &quot;Hoàn tiền&quot; để chỉ đồng
                  bộ trạng thái.
                </DsNotice>
              ) : null}
            </DsDialog>
          ) : null}

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Chi tiết khoản thu</h3>
            </div>
            <div className="ds-card__body">
              {selected.items?.length ? (
                selected.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13 }}>
                        {item.description}
                      </strong>
                      {item.quantity > 1 ? (
                        <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      ) : null}
                    </div>
                    <strong style={{ flex: "none" }}>
                      {formatCurrency(item.amount)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="ds-hint" style={{ margin: 0 }}>
                  Hóa đơn cũ chưa có dữ liệu khoản thu chi tiết.
                </p>
              )}
              <DsKeyValue
                items={[
                  {
                    label: "Tổng chi phí",
                    value: formatCurrency(selected.totalAmount),
                  },
                  {
                    label: "Giảm BHYT",
                    value:
                      selected.bhytDiscount > 0
                        ? `- ${formatCurrency(selected.bhytDiscount)}`
                        : formatCurrency(0),
                  },
                  {
                    label: "Cần thu",
                    value: (
                      <strong>{formatCurrency(selected.finalAmount)}</strong>
                    ),
                  },
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
                  {
                    label: "Phần đủ điều kiện",
                    value: formatCurrency(selected.insuranceEligibleAmount),
                  },
                  {
                    label: "Mức hưởng",
                    value: `${selected.insuranceCoverageRate}%`,
                  },
                  {
                    label: "Tuyến/loại",
                    value: selected.insuranceRouteType
                      ? insuranceRouteLabel[selected.insuranceRouteType]
                      : "-",
                  },
                  {
                    label: "Quỹ BHYT giảm",
                    value: formatCurrency(selected.insuranceDiscountAmount),
                  },
                ]}
              />
              {selected.insuranceNote ? (
                <p className="ds-hint" style={{ margin: 0 }}>
                  Ghi chú: {selected.insuranceNote}
                </p>
              ) : null}
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
                    {
                      label: "Phương thức",
                      value: selected.paymentMethod
                        ? paymentLabel[selected.paymentMethod] ||
                          selected.paymentMethod
                        : "-",
                    },
                    {
                      label: "Thời gian",
                      value: selected.paidAt
                        ? formatVietnamDateTime(selected.paidAt)
                        : "-",
                    },
                    {
                      label: "Số tiền",
                      value: (
                        <strong>{formatCurrency(selected.finalAmount)}</strong>
                      ),
                    },
                    ...(selected.paymentReference
                      ? [
                          {
                            label: "Mã tham chiếu",
                            value: selected.paymentReference,
                          },
                        ]
                      : []),
                  ]}
                />
              ) : (
                <p style={{ margin: 0, color: "var(--ds-muted)" }}>
                  Chưa thanh toán.
                </p>
              )}
              {selected.status === "PAID" &&
              selected.supplements &&
              selected.supplements.length > 0 ? (
                <SupplementPanel
                  invoiceId={selected.id}
                  supplements={selected.supplements}
                  canCollect={can(user, "invoice.collect")}
                  onChanged={invalidateInvoices}
                />
              ) : null}
              {canRefund && selected.status === "PAID" ? (
                <MedicineRefundPanel
                  invoiceId={selected.id}
                  onChanged={invalidateInvoices}
                />
              ) : null}
              {selected.status === "REFUNDED" ? (
                <DsKeyValue
                  items={[
                    {
                      label: "Lý do hoàn",
                      value: selected.refundReason || "-",
                    },
                    ...(selected.refundReference
                      ? [
                          {
                            label: "Tham chiếu hoàn",
                            value: selected.refundReference,
                          },
                        ]
                      : []),
                    {
                      label: "Hoàn lúc",
                      value: selected.refundedAt
                        ? formatVietnamDateTime(selected.refundedAt)
                        : "-",
                    },
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
                      Tạo lúc {formatVietnamDateTime(transaction.createdAt)} ·
                      hết hạn {formatVietnamDateTime(transaction.expiredAt)}
                    </small>
                    {transaction.providerOrderId ? (
                      <small>
                        Mã nhà cung cấp: {transaction.providerOrderId}
                      </small>
                    ) : null}
                  </div>
                  <DsStatusPill tone={transactionTone[transaction.status]}>
                    {transactionStatusLabel[transaction.status]}
                  </DsStatusPill>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>
                Chưa có giao dịch trực tuyến.
              </p>
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
            <ExportCsvButton
              ds
              path="/dashboard/invoices/export"
              fallbackName="hoa-don.csv"
              params={{ status: status || undefined }}
            />
            <DsButton variant="primary" onClick={startCreate}>
              <Plus aria-hidden="true" />
              Tạo hóa đơn
            </DsButton>
          </>
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}></div>
      {queryErrorMessage ? (
        <DsNotice tone="bad">{queryErrorMessage}</DsNotice>
      ) : null}
      <DsSplit wide list={list} pane={detailPane} />
      {creating ? (
        <CreateInvoiceDialog
          initialCode={initialCode}
          canUse={canUse}
          onClose={closePane}
          onIssued={(invoice, message) => {
            setCreating(false);
            setSelected(invoice);
            setNotice(message);
          }}
          onShowInvoiceCode={(code) => {
            setCreating(false);
            setSearch(code);
            setPage(1);
          }}
          invalidate={invalidateInvoices}
          onError={setError}
        />
      ) : null}
    </>
  );
}

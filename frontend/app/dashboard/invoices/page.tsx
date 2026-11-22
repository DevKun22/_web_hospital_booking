"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsInput,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsToolbar,
  type DsColumn,
  useActionToast,
} from "@/components/ds";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
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
import { formatVietnamDate } from "@/lib/date";
import { can } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type {
  Invoice,
} from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  type InvoiceAction,
  statusTabs,
  paymentOptions,
  statusLabel,
  statusTone,
  paymentLabel,
  doctorName,
} from "./invoice-model";
import { CreateInvoiceDialog } from "./create-invoice-dialog";
import { AdjustInvoiceDialog, CancelInvoiceDialog, PayInvoiceDialog, RefundInvoiceDialog } from "./invoice-action-dialogs";
import { InvoiceDetailCards } from "./invoice-detail-cards";

// Hóa đơn: danh sách bên trái; chọn một hóa đơn (hoặc bấm "Tạo hóa đơn") thì khung bên phải mở cạnh để xem chi tiết,
// áp dụng BHYT, ghi nhận thu, hủy hoặc hoàn tiền.

export default function InvoicesPage() {
  const { user } = useAuth();
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

  const canUse = can(user, "invoice.view");
  const canRefund = can(user, "invoice.refund");

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

  const resetActionState = () => setActionTarget(null);

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

  const actionProps = { onClose: resetActionState, onDone: updateSelectedInvoice, onError: setError };

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

      {activeAction?.type === "pay" ? <PayInvoiceDialog invoice={selected} {...actionProps} /> : null}
      {activeAction?.type === "cancel" ? <CancelInvoiceDialog invoice={activeAction.invoice} {...actionProps} /> : null}
      {activeAction?.type === "adjust" ? <AdjustInvoiceDialog invoice={activeAction.invoice} {...actionProps} /> : null}
      {activeAction?.type === "refund" ? <RefundInvoiceDialog invoice={activeAction.invoice} {...actionProps} /> : null}

      <InvoiceDetailCards invoice={selected} canRefund={canRefund} canCollect={can(user, "invoice.collect")} onChanged={invalidateInvoices} />
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

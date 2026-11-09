"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DsButton, DsDataTable, DsEmptyState, DsKeyValue, DsNotice, DsPageHeader, DsPane, DsPanel, DsSelect, DsSplit, DsToolbar, type DsColumn } from "@/components/ds";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { apiRequest } from "@/lib/api";
import type { Pagination } from "@/lib/types";

// Nhật ký truy cập: bảng chỉ thêm dòng; chọn một dòng thì khung bên phải hiện đầy đủ chi tiết (đối tượng, IP, dữ liệu kèm theo).

type AuditEntry = {
  id: string;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type AuditList = { items: AuditEntry[]; pagination: Pagination };

const actionLabels: Record<string, string> = {
  USER_CREATED: "Tạo tài khoản nhân sự",
  USER_UPDATED: "Sửa tài khoản (vai trò, email, số điện thoại)",
  USER_STATUS_CHANGED: "Khóa hoặc mở tài khoản",
  USER_PASSWORD_RESET: "Đặt lại mật khẩu cho người khác",
  PASSWORD_CHANGED: "Tự đổi mật khẩu",
  RBAC_MATRIX_UPDATED: "Đổi ma trận phân quyền",
  RBAC_MATRIX_RESET: "Khôi phục phân quyền mặc định",
  MEDICAL_RECORD_VIEWED: "Xem chi tiết bệnh án",
  PRESCRIPTION_VIEWED: "Xem chi tiết đơn thuốc",
  INVOICE_ADJUSTED: "Chỉnh số tiền hóa đơn",
  INVOICE_REFUNDED: "Hoàn tiền hóa đơn",
  INVOICE_REFUND_UNVERIFIED: "Hoàn tiền VNPay chưa xác nhận kết quả",
  DATA_EXPORTED: "Xuất báo cáo CSV",
  DATA_IMPORTED: "Nhập dữ liệu từ CSV",
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dashboard", "audit-logs", page, action],
    queryFn: () => apiRequest<AuditList>("/dashboard/audit-logs", { query: { page, limit: 20, action: action || undefined } }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const data = query.data;
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const columns: DsColumn<AuditEntry>[] = [
    { key: "time", header: "Thời gian", cell: (row) => <span style={{ whiteSpace: "nowrap" }}>{formatTime(row.createdAt)}</span> },
    {
      key: "actor",
      header: "Người thực hiện",
      cell: (row) => (
        <div>
          {row.actorName ?? "-"}
          {row.actorRole ? <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.actorRole}</div> : null}
        </div>
      ),
    },
    { key: "action", header: "Hành động", cell: (row) => actionLabels[row.action] ?? row.action },
    { key: "target", header: "Đối tượng", cell: (row) => row.targetType ?? "-" },
    { key: "ip", header: "IP", cell: (row) => <span className="ds-mono">{row.ipAddress ?? "-"}</span> },
  ];

  const list = (
    <DsPanel flush>
      <DsToolbar>
        <div style={{ minWidth: 200, flex: "1 1 260px" }}>
          <DsSelect
            aria-label="Lọc theo hành động"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
              setSelectedId(null);
            }}
          >
            <option value="">Mọi hành động</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </DsSelect>
        </div>
        <DsButton onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw aria-hidden="true" className={query.isFetching ? "animate-spin" : undefined} />
          Tải lại
        </DsButton>
      </DsToolbar>
      {query.isError ? (
        <div style={{ padding: 12 }}>
          <DsNotice tone="bad">Không tải được nhật ký.</DsNotice>
        </div>
      ) : null}
      {selected ? (
        items.length ? (
          <div role="listbox" aria-label="Danh sách bản ghi">
            {items.map((item) => (
              <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
                <span className="ds-listrow__main">
                  <strong>{actionLabels[item.action] ?? item.action}</strong>
                  <small>
                    {formatTime(item.createdAt)} · {item.actorName ?? "-"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có bản ghi nào" />
        )
      ) : (
        <DsDataTable caption="Nhật ký truy cập" columns={columns} rows={items} rowKey={(row) => row.id} loading={query.isLoading} emptyTitle="Chưa có bản ghi nào" onRowClick={(row) => setSelectedId(row.id)} />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} bản ghi · trang {pagination.page}/{Math.max(pagination.totalPages, 1)}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <DsButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Trước
          </DsButton>
          <DsButton disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>
            Sau
          </DsButton>
        </span>
      </div>
    </DsPanel>
  );

  const pane = selected ? (
    <DsPane title={actionLabels[selected.action] ?? selected.action} onClose={() => setSelectedId(null)}>
      <div style={{ display: "grid", gap: 12 }}>
        <DsKeyValue
          items={[
            { label: "Thời gian", value: formatTime(selected.createdAt) },
            { label: "Người thực hiện", value: `${selected.actorName ?? "-"}${selected.actorRole ? ` (${selected.actorRole})` : ""}` },
            { label: "Mã hành động", value: <span className="ds-mono">{selected.action}</span> },
            { label: "Đối tượng", value: selected.targetType ?? "-" },
            { label: "Mã đối tượng", value: <span className="ds-mono" style={{ wordBreak: "break-all" }}>{selected.targetId ?? "-"}</span> },
            { label: "Địa chỉ IP", value: <span className="ds-mono">{selected.ipAddress ?? "-"}</span> },
          ]}
        />
        <div>
          <strong style={{ fontSize: 13 }}>Dữ liệu kèm theo</strong>
          {selected.meta ? (
            <pre style={{ margin: "6px 0 0", maxHeight: 320, overflow: "auto", padding: 10, borderRadius: 6, background: "var(--ds-sunken)", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(selected.meta, null, 2)}
            </pre>
          ) : (
            <p className="ds-hint" style={{ margin: "6px 0 0" }}>
              Không có dữ liệu kèm theo.
            </p>
          )}
        </div>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Nhật ký truy cập"
        description="Ai làm gì với dữ liệu nhạy cảm: đổi quyền, quản lý tài khoản, xem bệnh án và đơn thuốc, chỉnh giảm và hoàn tiền hóa đơn. Nhật ký chỉ thêm dòng, không sửa hay xóa."
        actions={<ExportCsvButton ds path="/dashboard/audit-logs/export" fallbackName="nhat-ky-truy-cap.csv" params={{ action: action || undefined }} />}
      />
      <DsSplit list={list} pane={pane} />
    </>
  );
}

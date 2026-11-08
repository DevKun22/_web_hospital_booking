"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DashboardPageHeader, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import type { Pagination } from "@/lib/types";

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
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const query = useQuery({
    queryKey: ["dashboard", "audit-logs", page, action],
    queryFn: () =>
      apiRequest<AuditList>("/dashboard/audit-logs", {
        query: { page, limit: 20, action: action || undefined },
      }),
    staleTime: 0,
  });

  const data = query.data;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Hệ thống"
        title="Nhật ký truy cập"
        description="Ghi lại ai làm gì với dữ liệu nhạy cảm: đổi quyền, quản lý tài khoản, xem bệnh án và đơn thuốc, chỉnh giảm và hoàn tiền hóa đơn. Nhật ký chỉ thêm dòng, không sửa hay xóa được, và không chứa nội dung y tế."
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <ExportCsvButton
              path="/dashboard/audit-logs/export"
              fallbackName="nhat-ky-truy-cap.csv"
              params={{ action: action || undefined }}
            />
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Tải lại
            </Button>
          </div>
        }
      />

      <DashboardSurface className="p-4">
        <label className="flex flex-col gap-1 text-sm font-medium sm:max-w-xs">
          Lọc theo hành động
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
          >
            <option value="">Tất cả</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </DashboardSurface>

      <DashboardSurface className="overflow-x-auto">
        {query.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Không tải được nhật ký.
          </p>
        ) : null}
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Người thực hiện</th>
              <th className="px-4 py-3">Hành động</th>
              <th className="px-4 py-3">Đối tượng</th>
              <th className="px-4 py-3">Chi tiết</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {(data?.items ?? []).map((item) => (
              <tr key={item.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3">{formatTime(item.createdAt)}</td>
                <td className="px-4 py-3">
                  {item.actorName ?? "-"}
                  {item.actorRole ? (
                    <span className="block text-xs text-[var(--text-muted)]">{item.actorRole}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{actionLabels[item.action] ?? item.action}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  {item.targetType ?? "-"}
                  {item.targetId ? <span className="block break-all">{item.targetId}</span> : null}
                </td>
                <td className="max-w-xs px-4 py-3 text-xs">
                  {item.meta ? (
                    <code className="break-all whitespace-pre-wrap">{JSON.stringify(item.meta)}</code>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">{item.ipAddress ?? "-"}</td>
              </tr>
            ))}
            {data && data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Chưa có bản ghi nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </DashboardSurface>

      {data ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">
            Trang {data.pagination.page} / {Math.max(data.pagination.totalPages, 1)} ({data.pagination.total} bản ghi)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Trước
            </Button>
            <Button
              variant="outline"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

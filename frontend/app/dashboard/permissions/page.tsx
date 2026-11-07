"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, RotateCcw, Save } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { PolicyPanel } from "@/components/dashboard/policy-panel";
import {
  DashboardPageHeader,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";
import { dashboardRoleLabels } from "@/lib/dashboard-navigation";
import type { DashboardRole } from "@/lib/types";

type PermissionRow = {
  code: string;
  group: string;
  label: string;
  eligibleRoles: DashboardRole[];
  fixedRoles: DashboardRole[];
  roles: DashboardRole[];
};

type Matrix = { roles: DashboardRole[]; permissions: PermissionRow[] };

const queryKey = ["dashboard", "rbac"];

export default function DashboardPermissionsPage() {
  const queryClient = useQueryClient();
  const matrixQuery = useQuery({
    queryKey,
    queryFn: () => apiRequest<Matrix>("/dashboard/rbac"),
    staleTime: 0,
  });
  // Chỉ lưu các dòng người dùng đã sửa; dòng chưa sửa lấy từ máy chủ.
  const [edits, setEdits] = useState<Record<string, DashboardRole[]>>({});

  const rows = matrixQuery.data?.permissions;
  const rolesOf = (row: PermissionRow) => edits[row.code] ?? row.roles;
  const dirtyCodes = useMemo(
    () =>
      (rows || [])
        .filter((row) => {
          const current = edits[row.code];
          return (
            current !== undefined &&
            (current.length !== row.roles.length ||
              current.some((role) => !row.roles.includes(role)))
          );
        })
        .map((row) => row.code),
    [edits, rows],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest<Matrix>("/dashboard/rbac", {
        method: "PUT",
        body: {
          grants: Object.fromEntries(dirtyCodes.map((code) => [code, edits[code]])),
        },
      }),
    onSuccess: (data) => {
      setEdits({});
      queryClient.setQueryData(queryKey, data);
    },
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest<Matrix>("/dashboard/rbac", { method: "DELETE" }),
    onSuccess: (data) => {
      setEdits({});
      queryClient.setQueryData(queryKey, data);
    },
  });

  const toggle = (row: PermissionRow, role: DashboardRole) => {
    setEdits((current) => {
      const roles = current[row.code] ?? row.roles;
      return {
        ...current,
        [row.code]: roles.includes(role)
          ? roles.filter((item) => item !== role)
          : [...roles, role],
      };
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const row of rows || []) {
      map.set(row.group, [...(map.get(row.group) || []), row]);
    }
    return [...map.entries()];
  }, [rows]);

  const mutationError = [saveMutation.error, resetMutation.error].find(
    (error) => error instanceof Error,
  ) as Error | undefined;
  const notice = saveMutation.isSuccess
    ? "Đã lưu phân quyền, có hiệu lực ngay"
    : resetMutation.isSuccess
      ? "Đã khôi phục phân quyền mặc định"
      : undefined;

  return (
    <div className="space-y-6">
      <DashboardFeedback
        error={mutationError?.message}
        notice={notice}
        onDismiss={() => {
          saveMutation.reset();
          resetMutation.reset();
        }}
      />
      <DashboardPageHeader
        eyebrow="Hệ thống"
        title="Phân quyền và chính sách"
        description="Bật hoặc tắt quyền cho từng vai trò. Ô xám là quyền cố định hoặc vai trò không đủ điều kiện nhận quyền đó (ví dụ chỉ bác sĩ được kê đơn)."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void matrixQuery.refetch()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)]"
            >
              <RefreshCw className={`h-4 w-4 ${matrixQuery.isFetching ? "animate-spin" : ""}`} />
              Làm mới
            </button>
            <button
              type="button"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (window.confirm("Khôi phục toàn bộ phân quyền về mặc định?")) {
                  resetMutation.mutate();
                }
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)] disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Mặc định
            </button>
            <button
              type="button"
              disabled={dirtyCodes.length === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Lưu{dirtyCodes.length ? ` (${dirtyCodes.length})` : ""}
            </button>
          </div>
        }
      />

      {matrixQuery.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Đang tải phân quyền...</p>
      ) : null}
      {matrixQuery.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {matrixQuery.error instanceof Error ? matrixQuery.error.message : "Không tải được phân quyền"}
        </p>
      ) : null}

      {matrixQuery.data
        ? groups.map(([group, items]) => (
            <DashboardSurface key={group} className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-soft)] text-left">
                    <th className="px-5 py-3 font-semibold">{group}</th>
                    {matrixQuery.data.roles.map((role) => (
                      <th key={role} className="w-28 px-3 py-3 text-center font-semibold">
                        {dashboardRoleLabels[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {items.map((row) => (
                    <tr key={row.code}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{row.code}</p>
                      </td>
                      {matrixQuery.data.roles.map((role) => {
                        const eligible = row.eligibleRoles.includes(role);
                        const fixed = row.fixedRoles.includes(role);
                        const checked = rolesOf(row).includes(role);
                        return (
                          <td key={role} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${row.label}: ${dashboardRoleLabels[role]}`}
                              checked={checked}
                              disabled={!eligible || fixed}
                              onChange={() => toggle(row, role)}
                              className="h-4 w-4 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DashboardSurface>
          ))
        : null}

      <PolicyPanel />
    </div>
  );
}

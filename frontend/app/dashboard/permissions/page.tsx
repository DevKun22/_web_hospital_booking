"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DsButton, DsInput, DsNotice, DsPageHeader, DsPanel, DsTabs, DsToolbar } from "@/components/ds";
import { PolicyPanel } from "@/components/dashboard/policy-panel";
import { apiRequest } from "@/lib/api";
import { dashboardRoleLabels } from "@/lib/dashboard-navigation";
import type { DashboardRole } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Phân quyền và chính sách: ma trận quyền theo vai trò (sửa nhiều ô rồi lưu một lần, thanh lưu hiện số thay đổi) và tham số chính sách đặt lịch.

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
  const matrixQuery = useQuery({ queryKey, queryFn: () => apiRequest<Matrix>("/dashboard/rbac"), staleTime: 0 });
  // Chỉ lưu các dòng người dùng đã sửa; dòng chưa sửa lấy từ máy chủ.
  const [edits, setEdits] = useState<Record<string, DashboardRole[]>>({});
  const [view, setView] = useState("matrix");
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const term = useDebouncedValue(search.trim().toLowerCase());

  const rows = matrixQuery.data?.permissions;
  const rolesOf = (row: PermissionRow) => edits[row.code] ?? row.roles;
  const dirtyCodes = useMemo(
    () =>
      (rows || [])
        .filter((row) => {
          const current = edits[row.code];
          return current !== undefined && (current.length !== row.roles.length || current.some((role) => !row.roles.includes(role)));
        })
        .map((row) => row.code),
    [edits, rows],
  );

  const saveMutation = useMutation({
    mutationFn: () => apiRequest<Matrix>("/dashboard/rbac", { method: "PUT", body: { grants: Object.fromEntries(dirtyCodes.map((code) => [code, edits[code]])) } }),
    onSuccess: (data) => {
      setEdits({});
      queryClient.setQueryData(queryKey, data);
      setNotice("Đã lưu phân quyền, có hiệu lực ngay");
    },
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest<Matrix>("/dashboard/rbac", { method: "DELETE" }),
    onSuccess: (data) => {
      setEdits({});
      setConfirmReset(false);
      queryClient.setQueryData(queryKey, data);
      setNotice("Đã khôi phục phân quyền mặc định");
    },
  });

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const toggle = (row: PermissionRow, role: DashboardRole) => {
    setNotice("");
    setEdits((current) => {
      const roles = current[row.code] ?? row.roles;
      return { ...current, [row.code]: roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role] };
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const row of rows || []) {
      if (term && !`${row.label} ${row.code} ${row.group}`.toLowerCase().includes(term)) continue;
      map.set(row.group, [...(map.get(row.group) || []), row]);
    }
    return [...map.entries()];
  }, [rows, term]);

  const mutationError = [saveMutation.error, resetMutation.error].find((error) => error instanceof Error) as Error | undefined;

  return (
    <>
      <DsPageHeader
        title="Phân quyền và chính sách"
        description="Bật hoặc tắt quyền cho từng vai trò. Ô xám là quyền cố định hoặc vai trò không đủ điều kiện nhận quyền đó (ví dụ chỉ bác sĩ được kê đơn)."
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {mutationError ? <DsNotice tone="bad">{mutationError.message}</DsNotice> : null}
        {matrixQuery.error ? <DsNotice tone="bad">{matrixQuery.error instanceof Error ? matrixQuery.error.message : "Không tải được phân quyền"}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>

      <DsPanel flush>
        <DsTabs
          label="Phân quyền hoặc chính sách"
          items={[
            { id: "matrix", label: "Phân quyền theo vai trò" },
            { id: "policy", label: "Chính sách đặt lịch" },
          ]}
          value={view}
          onChange={setView}
        />
      </DsPanel>

      <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
        {view === "policy" ? <PolicyPanel /> : null}

        {view === "matrix" ? (
          <>
            <DsPanel flush>
              <DsToolbar>
                <div style={{ minWidth: 180, flex: "1 1 260px" }}>
                  <DsInput aria-label="Tìm quyền" value={search} placeholder="Gõ tên quyền, mã quyền hoặc nhóm để lọc" onChange={(event) => setSearch(event.target.value)} />
                </div>
                <DsButton onClick={() => void matrixQuery.refetch()}>
                  <RefreshCw aria-hidden="true" className={matrixQuery.isFetching ? "animate-spin" : undefined} />
                  Làm mới
                </DsButton>
                {confirmReset ? (
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>Khôi phục toàn bộ phân quyền về mặc định?</span>
                    <DsButton variant="danger" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
                      Khôi phục
                    </DsButton>
                    <DsButton onClick={() => setConfirmReset(false)}>Giữ lại</DsButton>
                  </span>
                ) : (
                  <DsButton disabled={resetMutation.isPending} onClick={() => setConfirmReset(true)}>
                    Mặc định
                  </DsButton>
                )}
              </DsToolbar>
              {matrixQuery.isLoading ? <p style={{ margin: 0, padding: 16, color: "var(--ds-muted)" }}>Đang tải phân quyền...</p> : null}
            </DsPanel>

            {matrixQuery.data
              ? groups.map(([group, items]) => (
                  <DsPanel key={group} title={group} flush>
                    <div className="ds-table-wrap">
                      <table className="ds-table">
                        <caption className="sr-only">{`Quyền nhóm ${group}`}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Quyền</th>
                            {matrixQuery.data.roles.map((role) => (
                              <th key={role} scope="col" style={{ textAlign: "center", width: 112 }}>
                                {dashboardRoleLabels[role]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((row) => (
                            <tr key={row.code}>
                              <td>
                                <strong>{row.label}</strong>
                                <div className="ds-mono" style={{ color: "var(--ds-muted)", fontSize: 12 }}>
                                  {row.code}
                                </div>
                              </td>
                              {matrixQuery.data.roles.map((role) => {
                                const eligible = row.eligibleRoles.includes(role);
                                const fixed = row.fixedRoles.includes(role);
                                const checked = rolesOf(row).includes(role);
                                const changed = edits[row.code] !== undefined && checked !== row.roles.includes(role);
                                return (
                                  <td key={role} style={{ textAlign: "center", background: changed ? "var(--ds-warn-soft)" : undefined }}>
                                    <input
                                      type="checkbox"
                                      aria-label={`${row.label}: ${dashboardRoleLabels[role]}`}
                                      checked={checked}
                                      disabled={!eligible || fixed}
                                      onChange={() => toggle(row, role)}
                                      style={{ width: 16, height: 16, accentColor: "var(--ds-accent)", cursor: !eligible || fixed ? "not-allowed" : "pointer", opacity: !eligible || fixed ? 0.4 : 1 }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DsPanel>
                ))
              : null}
            {matrixQuery.data && groups.length === 0 ? <DsNotice tone="info">Không có quyền nào khớp với từ khóa.</DsNotice> : null}

            {dirtyCodes.length > 0 ? (
              <div className="ds-savebar" style={{ position: "sticky", bottom: 0, border: "1px solid var(--ds-line)", borderRadius: 8, background: "var(--ds-surface)" }}>
                <span className="ds-savebar__msg">{dirtyCodes.length} quyền có thay đổi chưa lưu (ô nền vàng)</span>
                <DsButton onClick={() => setEdits({})} disabled={saveMutation.isPending}>
                  Hủy thay đổi
                </DsButton>
                <DsButton variant="primary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? "Đang lưu..." : `Lưu (${dirtyCodes.length})`}
                </DsButton>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

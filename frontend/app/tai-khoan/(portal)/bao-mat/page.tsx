"use client";

import { Loader2, LogOut } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { usePatientSessions, useRevokeSession } from "@/features/portal/hooks";
import { formatShortDateTime } from "@/lib/format";
import type { PatientSession } from "@/lib/patient-portal-types";

const deviceLabel = (session: PatientSession) =>
  session.deviceName || (session.platform === "web" ? "Trình duyệt Web" : session.platform === "android" ? "Thiết bị Android" : session.platform === "ios" ? "Thiết bị iOS" : "Thiết bị đăng nhập");

export default function PatientSecurityPage() {
  const query = usePatientSessions();
  const revoke = useRevokeSession();

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Thiết bị đăng nhập" description="Các thiết bị còn đăng nhập tài khoản này. Đăng xuất thiết bị bạn không nhận ra; phiên hiện tại không bị ảnh hưởng." />

      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được danh sách phiên."} onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <PatientEmptyState title="Không có phiên đăng nhập" description="Hãy đăng nhập lại nếu phiên hiện tại đã hết hiệu lực." />
      ) : (
        <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
          {query.data.map((session) => (
            <li key={session.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold">
                  {deviceLabel(session)}
                  {session.isCurrent ? <span className="ml-2 rounded-md bg-[var(--public-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--public-success)]">Thiết bị này</span> : null}
                </p>
                <p className="mt-0.5 break-words text-sm text-[var(--public-muted)]">
                  Hoạt động {formatShortDateTime(session.lastUsedAt)}
                  {session.ipAddress ? ` · IP ${session.ipAddress}` : ""}
                  {session.appVersion ? ` · Phiên bản ${session.appVersion}` : ""}
                </p>
              </div>
              {!session.isCurrent ? (
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (window.confirm(`Đăng xuất ${deviceLabel(session)}?`)) revoke.mutate(session.id);
                  }}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--public-danger)] px-4 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)] disabled:opacity-60"
                >
                  {revoke.isPending && revoke.variables === session.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
                  Đăng xuất thiết bị
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {revoke.isError ? <p role="alert" className="text-sm text-[var(--public-danger)]">{revoke.error instanceof Error ? revoke.error.message : "Không thể thu hồi phiên."}</p> : null}
    </div>
  );
}

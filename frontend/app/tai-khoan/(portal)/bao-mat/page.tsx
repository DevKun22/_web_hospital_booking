"use client";

import { useState } from "react";
import { Laptop, Loader2, Smartphone } from "lucide-react";
import { PatientEmptyState, PatientPageError, PatientPageHeader, PatientPageLoading } from "@/components/patient/patient-page-ui";
import { useMutationToast } from "@/components/patient/patient-toast";
import { usePatientSessions, useRevokeOtherSessions, useRevokeSession } from "@/features/portal/hooks";
import { splitDeviceName } from "@/lib/device-label";
import { formatShortDateTime } from "@/lib/format";
import type { PatientSession } from "@/lib/patient-portal-types";

const isMobile = (session: PatientSession) => session.platform === "android" || session.platform === "ios";

// Che hai đoạn cuối của IP để vẫn nhận ra mà không lộ đầy đủ.
function maskIp(ip: string) {
  if (ip.includes(":")) return `${ip.split(":").slice(0, 2).join(":")}:…`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : ip;
}

function describe(session: PatientSession) {
  const { device, location } = splitDeviceName(session.deviceName);
  if (isMobile(session)) return { title: session.platform === "ios" ? "Ứng dụng iOS" : "Ứng dụng Android", location };
  return { title: device || "Trình duyệt Web", location };
}

// IP của phiên web là IP máy chủ web, không phải của người dùng, nên chỉ hiện IP cho ứng dụng di động.
function details(session: PatientSession, location: string) {
  return [
    location,
    `Hoạt động ${formatShortDateTime(session.lastUsedAt)}`,
    isMobile(session) && session.ipAddress ? `IP ${maskIp(session.ipAddress)}` : "",
    session.appVersion ? `phiên bản ${session.appVersion}` : "",
  ].filter(Boolean).join(" · ");
}

function DeviceIcon({ session, active }: { session: PatientSession; active?: boolean }) {
  const Icon = isMobile(session) ? Smartphone : Laptop;
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active ? "bg-[var(--public-success-soft)] text-[var(--public-success)]" : "bg-[var(--public-surface-muted)] text-[var(--public-text-soft)]"}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

const DANGER_BUTTON = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--public-danger)] px-4 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)] disabled:opacity-60";

export default function PatientSecurityPage() {
  const query = usePatientSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  useMutationToast(revoke, { success: "Đã đăng xuất thiết bị.", fallbackError: "Không thể đăng xuất thiết bị." });
  useMutationToast(revokeOthers, { success: "Đã đăng xuất các thiết bị khác.", fallbackError: "Không thể đăng xuất hết các thiết bị khác." });

  const sessions = query.data ?? [];
  const current = sessions.find((session) => session.isCurrent);
  const others = sessions.filter((session) => !session.isCurrent);

  return (
    <div className="space-y-5">
      <PatientPageHeader title="Bảo mật" description="Các thiết bị còn đăng nhập tài khoản này." />

      {query.isLoading ? (
        <PatientPageLoading />
      ) : query.isError ? (
        <PatientPageError message={query.error instanceof Error ? query.error.message : "Không tải được danh sách phiên."} onRetry={() => query.refetch()} />
      ) : !sessions.length ? (
        <PatientEmptyState title="Không có phiên đăng nhập" description="Hãy đăng nhập lại nếu phiên hiện tại đã hết hiệu lực." />
      ) : (
        <>
          {current ? (
            <section aria-label="Thiết bị này">
              <h2 className="mb-2 text-sm font-semibold text-[var(--public-muted)]">Thiết bị này</h2>
              {(() => {
                const { title, location } = describe(current);
                return (
                  <div className="flex items-center gap-3 rounded-xl border-2 border-[var(--public-success)] bg-[var(--public-surface)] p-4">
                    <DeviceIcon session={current} active />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{title} <span className="ml-1 rounded-full bg-[var(--public-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--public-success)]">Đang dùng</span></p>
                      <p className="break-words text-xs text-[var(--public-muted)]">{details(current, location)}</p>
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : null}

          <section aria-label="Thiết bị khác">
            <h2 className="mb-2 text-sm font-semibold text-[var(--public-muted)]">Thiết bị khác ({others.length})</h2>
            {others.length ? (
              <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
                {others.map((session) => {
                  const { title, location } = describe(session);
                  const confirming = confirmId === session.id;
                  const busy = revoke.isPending && revoke.variables === session.id;
                  return (
                    <li key={session.id} className="flex flex-wrap items-center gap-3 p-4">
                      <DeviceIcon session={session} />
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="break-words text-xs text-[var(--public-muted)]">{details(session, location)}</p>
                      </div>
                      {confirming ? (
                        <div className="flex gap-2">
                          <button type="button" disabled={busy} onClick={() => revoke.mutate(session.id, { onSettled: () => setConfirmId(null) })} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--public-danger)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            Xác nhận
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="public-button-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">Giữ</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setConfirmAll(false); setConfirmId(session.id); }} className={DANGER_BUTTON}>Đăng xuất</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--public-border)] p-4 text-sm text-[var(--public-muted)]">Không có thiết bị nào khác đang đăng nhập.</p>
            )}
          </section>

          {others.length ? (
            <section className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--public-muted)]">Không nhận ra thiết bị nào? Đăng xuất rồi đăng nhập lại bằng OTP.</p>
              {confirmAll ? (
                <div className="flex gap-2">
                  <button type="button" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate(others.map((session) => session.id), { onSettled: () => setConfirmAll(false) })} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--public-danger)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                    {revokeOthers.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Xác nhận đăng xuất {others.length} thiết bị
                  </button>
                  <button type="button" onClick={() => setConfirmAll(false)} className="public-button-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">Giữ</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setConfirmId(null); setConfirmAll(true); }} className={DANGER_BUTTON}>Đăng xuất tất cả thiết bị khác</button>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DsButton } from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { downloadCsv } from "@/lib/api";

// Nút xuất báo cáo CSV dùng chung. Có chọn khoảng ngày (mặc định 30 ngày gần nhất, tối đa 366 ngày,
// tối đa 5.000 dòng); `ranged={false}` cho báo cáo không theo thời gian (ví dụ tồn kho hiện tại).
export function ExportCsvButton({
  path,
  fallbackName,
  params,
  ranged = true,
  label = "Xuất CSV",
  ds = false,
}: {
  path: string;
  fallbackName: string;
  params?: Record<string, string | undefined>;
  ranged?: boolean;
  label?: string;
  /** Dùng nút kiểu thiết kế mới (trong khu .ds). */
  ds?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadCsv(
        path,
        { ...params, ...(ranged ? { from: from || undefined, to: to || undefined } : {}) },
        fallbackName,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xuất được báo cáo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {ranged ? (
          <>
            <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              Từ
              <VietnamDateInput value={from} onChange={setFrom} ariaLabel="Từ ngày" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]" />
            </label>
            <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              Đến
              <VietnamDateInput value={to} onChange={setTo} ariaLabel="Đến ngày" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]" />
            </label>
          </>
        ) : null}
        {ds ? (
          <DsButton disabled={busy} onClick={() => void run()}>
            <Download aria-hidden="true" />
            {busy ? "Đang xuất..." : label}
          </DsButton>
        ) : (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run()}>
            <Download className="size-4" aria-hidden="true" />
            {busy ? "Đang xuất..." : label}
          </Button>
        )}
      </div>
      {ranged ? (
        <p className="text-xs text-[var(--text-muted)]">Bỏ trống: 30 ngày gần nhất. Tối đa 366 ngày và 5.000 dòng.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

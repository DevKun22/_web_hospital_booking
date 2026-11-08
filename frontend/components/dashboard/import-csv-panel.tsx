"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

type ImportRow = {
  line: number;
  code: string;
  action: "create" | "update" | "unchanged" | "receive" | "error";
  quantity?: number;
  errors: string[];
};

type ImportResult = {
  applied: boolean;
  rows: ImportRow[];
  summary: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    receive: number;
    errors: number;
    totalQuantity: number;
  };
};

const actionLabel: Record<ImportRow["action"], string> = {
  create: "Thêm mới",
  update: "Cập nhật",
  unchanged: "Không đổi",
  receive: "Nhập kho",
  error: "Lỗi",
};

// Nhập CSV theo hai bước: chọn tệp -> kiểm tra (không ghi gì) -> xác nhận áp dụng.
// Máy chủ kiểm tra lại toàn bộ tệp khi áp dụng và chỉ ghi khi không có dòng nào lỗi.
export function ImportCsvPanel({
  path,
  title,
  templateName,
  templateCsv,
  hint,
  onDone,
}: {
  path: string;
  title: string;
  templateName: string;
  templateCsv: string;
  hint: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCsv("");
    setFileName("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const pick = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (file.size > 800_000) {
      setError("Tệp quá lớn (tối đa khoảng 800 KB)");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  };

  const send = async (apply: boolean) => {
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<ImportResult>(path, { method: "POST", body: { csv, apply } });
      setResult(data);
      if (data.applied) onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không nhập được tệp");
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + templateCsv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = templateName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileUp className="size-4" aria-hidden="true" />
        {title}
      </Button>
    );
  }

  const canApply = Boolean(result && !result.applied && result.summary.errors === 0 && result.rows.length > 0);

  return (
    <div className="w-full space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Đóng
        </Button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Chọn tệp CSV"
          onChange={(event) => void pick(event.target.files?.[0])}
          className="text-xs"
        />
        <Button type="button" variant="ghost" onClick={downloadTemplate}>
          Tải tệp mẫu
        </Button>
        <Button type="button" variant="outline" disabled={!csv || busy} onClick={() => void send(false)}>
          {busy && !canApply ? "Đang kiểm tra..." : "Kiểm tra tệp"}
        </Button>
        {canApply ? (
          <Button type="button" disabled={busy} onClick={() => void send(true)}>
            {busy ? "Đang nhập..." : "Áp dụng"}
          </Button>
        ) : null}
      </div>
      {fileName ? <p className="text-xs text-[var(--text-muted)]">Tệp: {fileName}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2">
          <p role="status" className={result.summary.errors > 0 ? "font-semibold text-destructive" : "font-semibold"}>
            {result.applied
              ? `Đã nhập ${result.summary.total} dòng.`
              : result.summary.errors > 0
                ? `Có ${result.summary.errors} dòng lỗi, chưa nhập gì. Sửa tệp rồi kiểm tra lại.`
                : `Tệp hợp lệ: ${result.summary.create} thêm mới, ${result.summary.update} cập nhật, ${result.summary.unchanged} không đổi, ${result.summary.receive} nhập kho. Bấm Áp dụng để ghi.`}
          </p>
          <div className="max-h-64 overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[var(--surface-soft)]">
                <tr>
                  <th className="px-2 py-1.5">Dòng</th>
                  <th className="px-2 py-1.5">Mã thuốc</th>
                  <th className="px-2 py-1.5">Kết quả</th>
                  <th className="px-2 py-1.5">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.line} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1.5">{row.line}</td>
                    <td className="px-2 py-1.5 font-mono">{row.code || "—"}</td>
                    <td className="px-2 py-1.5">{actionLabel[row.action]}</td>
                    <td className="px-2 py-1.5">
                      {row.errors.length > 0
                        ? row.errors.join("; ")
                        : row.quantity
                          ? `+${row.quantity}`
                          : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

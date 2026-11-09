"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { DsButton, DsDataTable, DsNotice, DsPanel, type DsColumn } from "@/components/ds";
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

const columns: DsColumn<ImportRow>[] = [
  { key: "line", header: "Dòng", cell: (row) => row.line },
  { key: "code", header: "Mã thuốc", cell: (row) => <span className="ds-mono">{row.code || "—"}</span> },
  { key: "action", header: "Kết quả", cell: (row) => actionLabel[row.action] },
  { key: "detail", header: "Chi tiết", cell: (row) => (row.errors.length > 0 ? row.errors.join("; ") : row.quantity ? `+${row.quantity}` : "") },
];

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
      <DsButton onClick={() => setOpen(true)}>
        <FileUp aria-hidden="true" />
        {title}
      </DsButton>
    );
  }

  const canApply = Boolean(result && !result.applied && result.summary.errors === 0 && result.rows.length > 0);

  return (
    <div style={{ flexBasis: "100%", width: "min(720px, 100%)" }}>
      <DsPanel
        title={title}
        actions={
          <DsButton
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Đóng
          </DsButton>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <p className="ds-hint" style={{ margin: 0 }}>
            {hint}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="Chọn tệp CSV"
              onChange={(event) => void pick(event.target.files?.[0])}
              style={{ fontSize: 13 }}
            />
            <DsButton variant="ghost" onClick={downloadTemplate}>
              Tải tệp mẫu
            </DsButton>
            <DsButton disabled={!csv || busy} onClick={() => void send(false)}>
              {busy && !canApply ? "Đang kiểm tra..." : "Kiểm tra tệp"}
            </DsButton>
            {canApply ? (
              <DsButton variant="primary" disabled={busy} onClick={() => void send(true)}>
                {busy ? "Đang nhập..." : "Áp dụng"}
              </DsButton>
            ) : null}
          </div>
          {fileName ? <p className="ds-hint" style={{ margin: 0 }}>Tệp: {fileName}</p> : null}
          {error ? <DsNotice tone="bad">{error}</DsNotice> : null}
          {result ? (
            <>
              <DsNotice tone={result.summary.errors > 0 ? "bad" : result.applied ? "good" : "info"}>
                {result.applied
                  ? `Đã nhập ${result.summary.total} dòng.`
                  : result.summary.errors > 0
                    ? `Có ${result.summary.errors} dòng lỗi, chưa nhập gì. Sửa tệp rồi kiểm tra lại.`
                    : `Tệp hợp lệ: ${result.summary.create} thêm mới, ${result.summary.update} cập nhật, ${result.summary.unchanged} không đổi, ${result.summary.receive} nhập kho. Bấm Áp dụng để ghi.`}
              </DsNotice>
              <div style={{ maxHeight: 256, overflow: "auto" }}>
                <DsDataTable caption="Kết quả kiểm tra tệp" columns={columns} rows={result.rows} rowKey={(row) => String(row.line)} />
              </div>
            </>
          ) : null}
        </div>
      </DsPanel>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ShieldCheck, Wrench } from "lucide-react";
import { DsButton, DsEditDialog, DsKeyValue, DsStatusPill } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { reconciliationFindingLabels, type SlotReconciliationResult } from "./schedule-model";

// Đối soát khung giờ với lịch hẹn: bước kiểm tra chỉ đọc, bước khắc phục chỉ sửa các trường hợp an toàn.

export function ReconcileDialog({
  onClose,
  onNotice,
  onError,
  invalidateSlots,
}: {
  onClose: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidateSlots: () => Promise<void>;
}) {
  const [result, setResult] = useState<SlotReconciliationResult | null>(null);
  const [running, setRunning] = useState<"scan" | "repair" | null>(null);
  const hasRepairable = Boolean(result?.findings.some((finding) => finding.type !== "APPOINTMENT_SLOT_MISMATCH" && !finding.repaired));

  const reconcile = async (repair: boolean) => {
    setRunning(repair ? "repair" : "scan");
    onError("");
    onNotice("");
    try {
      const response = await apiRequest<SlotReconciliationResult>("/dashboard/doctor-time-slots/reconcile", { method: "POST", body: { repair, batchSize: 500 } });
      setResult(response);
      onNotice(
        repair
          ? `Đã đối soát ${response.scanned} khung giờ và sửa ${response.repairedCount} sai lệch an toàn.`
          : `Đã kiểm tra ${response.scanned} khung giờ, phát hiện ${response.findingCount} sai lệch.`,
      );
      if (repair && response.repairedCount > 0) await invalidateSlots();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không thể đối soát khung giờ");
    } finally {
      setRunning(null);
    }
  };

  return (
    <DsEditDialog size="lg" title="Đối soát khung giờ" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <p className="ds-hint" style={{ margin: 0 }}>
          Phát hiện khung giờ và lịch hẹn lệch trạng thái. Bước kiểm tra chỉ đọc dữ liệu; bước khắc phục chỉ sửa các trường hợp an toàn.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <DsButton disabled={Boolean(running)} onClick={() => void reconcile(false)}>
            <ShieldCheck aria-hidden="true" />
            {running === "scan" ? "Đang kiểm tra..." : "Kiểm tra dữ liệu"}
          </DsButton>
          <DsButton variant="primary" disabled={Boolean(running) || !hasRepairable} title={!hasRepairable ? "Chạy kiểm tra trước; chỉ khắc phục khi có sai lệch sửa được" : undefined} onClick={() => void reconcile(true)}>
            <Wrench aria-hidden="true" />
            {running === "repair" ? "Đang khắc phục..." : "Khắc phục an toàn"}
          </DsButton>
        </div>
        {result ? (
          <div className="ds-card">
            <div className="ds-card__body">
              <DsKeyValue
                items={[
                  { label: "Đã quét", value: result.scanned },
                  { label: "Sai lệch", value: result.findingCount },
                  { label: "Đã sửa", value: result.repairedCount },
                ]}
              />
            </div>
            {result.findings.slice(0, 8).map((finding) => (
              <div key={`${finding.type}-${finding.slotId}`} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>{reconciliationFindingLabels[finding.type]}</strong>
                  <small>
                    Slot: {finding.slotId}
                    {finding.appointmentId ? ` · Lịch hẹn: ${finding.appointmentId}` : ""}
                  </small>
                </div>
                <DsStatusPill tone={finding.repaired ? "good" : finding.type === "APPOINTMENT_SLOT_MISMATCH" ? "bad" : "warn"}>
                  {finding.repaired ? "Đã sửa" : finding.type === "APPOINTMENT_SLOT_MISMATCH" ? "Cần kiểm tra thủ công" : "Chưa sửa"}
                </DsStatusPill>
              </div>
            ))}
            {result.findings.length > 8 ? <p className="ds-hint" style={{ margin: 0, padding: "10px 14px" }}>Còn {result.findings.length - 8} sai lệch khác trong lượt đối soát này.</p> : null}
            {result.findings.length === 0 ? <p style={{ margin: 0, padding: 14, color: "var(--ds-good)" }}>Dữ liệu khung giờ đang nhất quán.</p> : null}
          </div>
        ) : null}
      </div>
    </DsEditDialog>
  );
}

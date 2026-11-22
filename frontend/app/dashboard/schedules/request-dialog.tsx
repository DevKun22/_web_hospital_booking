"use client";

import { useState } from "react";
import { DsButton, DsEditDialog, DsField, DsInput, DsKeyValue, DsStatusPill } from "@/components/ds";
import { requestTypeLabels, scheduleDays } from "@/components/schedules/schedule-request-form";
import { apiRequest } from "@/lib/api";
import { formatVietnamDate } from "@/lib/date";
import type { ScheduleChangeRequest } from "@/lib/types";
import { doctorName, impactText, requestStatusLabel, requestStatusTone, type ScheduleImpact } from "./schedule-model";

// Chi tiết một yêu cầu đổi lịch: người duyệt duyệt hoặc từ chối (kèm lý do), bác sĩ hủy yêu cầu đang chờ.

const dayLabel = (day: number) => scheduleDays[day] ?? "";

export function RequestDialog({
  request,
  isDoctor,
  canWrite,
  onClose,
  onNotice,
  onError,
  invalidateSlots,
  invalidateSchedules,
}: {
  request: ScheduleChangeRequest;
  isDoctor: boolean;
  canWrite: boolean;
  onClose: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidateSlots: () => Promise<void>;
  invalidateSchedules: () => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reviewerNote, setReviewerNote] = useState("");
  const [saving, setSaving] = useState(false);

  const review = async (status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !reviewerNote.trim()) {
      onError("Cần nêu lý do từ chối yêu cầu");
      return;
    }
    setSaving(true);
    onError("");
    try {
      const reviewed = await apiRequest<ScheduleChangeRequest & { impact?: ScheduleImpact }>(`/dashboard/schedule-change-requests/${request.id}/review`, {
        method: "PATCH",
        body: { status, reviewerNote: reviewerNote.trim() || null },
      });
      if (status === "APPROVED") await invalidateSlots();
      onNotice(status === "APPROVED" ? `Đã duyệt và áp dụng lịch mẫu.${impactText(reviewed.impact)}` : "Đã từ chối yêu cầu đổi lịch.");
      setRejecting(false);
      setReviewerNote("");
      await invalidateSchedules();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xử lý được yêu cầu");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setSaving(true);
    onError("");
    try {
      await apiRequest<ScheduleChangeRequest>(`/dashboard/schedule-change-requests/${request.id}/cancel`, { method: "PATCH" });
      onNotice("Đã hủy yêu cầu đổi lịch.");
      await invalidateSchedules();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không hủy được yêu cầu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsEditDialog
      size="lg"
      title={isDoctor ? requestTypeLabels[request.type] : doctorName(request.doctor)}
      badge={<DsStatusPill tone={requestStatusTone[request.status]}>{requestStatusLabel[request.status]}</DsStatusPill>}
      onClose={onClose}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <DsKeyValue
          items={[
            ...(!isDoctor ? [{ label: "Loại yêu cầu", value: requestTypeLabels[request.type] }] : []),
            { label: "Lịch mẫu đề xuất", value: `${dayLabel(request.dayOfWeek)} · ${request.startTime} - ${request.endTime}` },
            { label: "Khung giờ", value: `${request.slotDuration} phút / khung giờ` },
            { label: "Áp dụng từ", value: formatVietnamDate(request.effectiveFrom) },
            { label: "Lý do", value: request.reason },
            ...(request.reviewerNote ? [{ label: "Phản hồi", value: request.reviewerNote }] : []),
          ]}
        />
        {request.status === "PENDING" ? (
          isDoctor ? (
            <div>
              <DsButton variant="danger" disabled={saving} onClick={() => void cancel()}>
                Hủy yêu cầu
              </DsButton>
            </div>
          ) : canWrite ? (
            rejecting ? (
              <div style={{ display: "grid", gap: 8 }}>
                <DsField label="Lý do từ chối" htmlFor="reject-note" required>
                  <DsInput id="reject-note" value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value.slice(0, 500))} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => { setRejecting(false); setReviewerNote(""); }}>Hủy</DsButton>
                  <DsButton variant="danger" disabled={saving || !reviewerNote.trim()} onClick={() => void review("REJECTED")}>
                    Xác nhận từ chối
                  </DsButton>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <DsButton variant="primary" disabled={saving} onClick={() => void review("APPROVED")}>
                  Duyệt
                </DsButton>
                <DsButton disabled={saving} onClick={() => setRejecting(true)}>
                  Từ chối
                </DsButton>
              </div>
            )
          ) : null
        ) : null}
        <p className="ds-hint" style={{ margin: 0 }}>
          Duyệt yêu cầu sẽ cập nhật lịch mẫu; khung giờ đã sinh và lịch đã đặt không tự thay đổi.
        </p>
      </div>
    </DsEditDialog>
  );
}

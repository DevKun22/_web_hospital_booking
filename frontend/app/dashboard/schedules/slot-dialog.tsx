"use client";

import { useState } from "react";
import { DsButton, DsEditDialog, DsField, DsKeyValue, DsNotice, DsStatusPill, DsTextarea, useConfirm } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { formatVietnamDate, isVietnamSlotStartInPast } from "@/lib/date";
import type { DoctorTimeSlot, TimeSlotStatus } from "@/lib/types";
import { doctorName, effectiveSlotStatus } from "./schedule-model";

// Chi tiết một khung giờ: khóa và mở khóa, đặt lại trạng thái, xóa. Khung giờ đã có lịch hẹn hoặc đã qua thì chỉ xem.

export function SlotDialog({
  slot,
  canWrite,
  canManageSlots,
  onClose,
  onNotice,
  onError,
  invalidateSlots,
}: {
  slot: DoctorTimeSlot;
  canWrite: boolean;
  canManageSlots: boolean;
  onClose: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidateSlots: () => Promise<void>;
}) {
  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);

  const status = effectiveSlotStatus(slot);
  const past = isVietnamSlotStartInPast(slot.date, slot.startTime);
  const editable = canManageSlots && !slot.appointment && slot.status !== "BOOKED" && !past;

  // Thao tác một bước: báo kết quả, làm mới danh sách; lỗi hiện thành thông báo.
  const act = async (request: () => Promise<unknown>, success: string, failure: string, after?: () => void) => {
    onError("");
    onNotice("");
    try {
      await request();
      onNotice(success);
      after?.();
      await invalidateSlots();
    } catch (err) {
      onError(err instanceof Error ? err.message : failure);
    }
  };

  const setStatusTo = (next: TimeSlotStatus) => {
    if (!canWrite) return;
    void act(() => apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/status`, { method: "PATCH", body: { status: next, lockReason: null } }), "Đã cập nhật khung giờ", "Không cập nhật được khung giờ");
  };

  const unlock = () => {
    if (!canManageSlots) return;
    void act(() => apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/unlock`, { method: "PATCH" }), "Đã mở khóa khung giờ", "Không mở khóa được khung giờ");
  };

  const askDelete = async () => {
    if (!(await confirm({ title: "Xoá khung giờ này?", message: "Khung giờ sẽ bị xoá. Không hoàn tác được.", confirmLabel: "Xoá khung giờ", tone: "danger" }))) return;
    await remove();
  };

  const remove = () => {
    if (!canWrite) return;
    void act(() => apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}`, { method: "DELETE" }), "Đã xoá khung giờ", "Không xoá được khung giờ", onClose);
  };

  const lock = async () => {
    if (!canManageSlots) return;
    const reason = lockReason.trim();
    if (reason.length < 2) {
      onError("Lý do khóa khung giờ cần có ít nhất 2 ký tự");
      return;
    }
    setSaving(true);
    await act(
      () => apiRequest<DoctorTimeSlot>(`/dashboard/doctor-time-slots/${slot.id}/lock`, { method: "PATCH", body: { lockReason: reason } }),
      "Đã khóa khung giờ khám",
      "Không khóa được khung giờ",
      () => {
        setLockOpen(false);
        setLockReason("");
      },
    );
    setSaving(false);
  };

  return (
    <DsEditDialog
      size="lg"
      title={`${formatVietnamDate(slot.date)} · ${slot.startTime} - ${slot.endTime}`}
      badge={<DsStatusPill tone={status.tone}>{status.label}</DsStatusPill>}
      onClose={onClose}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <DsKeyValue
          items={[
            { label: "Bác sĩ", value: doctorName(slot.doctor) },
            { label: "Khoa", value: slot.doctor.department.name },
            { label: "Lịch hẹn", value: slot.appointment?.bookingCode || "Chưa có" },
            ...(slot.lockReason ? [{ label: "Lý do khóa", value: slot.lockReason }] : []),
          ]}
        />
        {status.note ? <DsNotice tone="info">{status.note}</DsNotice> : null}
        {!editable ? (
          <DsNotice tone="info">
            {slot.appointment || slot.status === "BOOKED" ? "Khung giờ đã có lịch hẹn nên không thay đổi được ở đây; đổi lịch hoặc hủy từ trang Lịch hẹn." : past ? "Khung giờ đã qua nên không thay đổi được." : "Tài khoản không có quyền thay đổi khung giờ."}
          </DsNotice>
        ) : (
          <>
            {lockOpen ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void lock();
                }}
                style={{ display: "grid", gap: 8 }}
                aria-label="Khóa khung giờ"
              >
                <DsField label="Lý do khóa" htmlFor="lock-reason" required hint="Khung giờ chưa có lịch hẹn sẽ tạm ẩn khỏi luồng đặt lịch; có thể mở khóa lại.">
                  <DsTextarea id="lock-reason" rows={3} value={lockReason} placeholder="Ví dụ: bận họp chuyên môn" onChange={(event) => setLockReason(event.target.value.slice(0, 300))} />
                </DsField>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <DsButton onClick={() => { setLockOpen(false); setLockReason(""); }}>Hủy</DsButton>
                  <DsButton type="submit" variant="primary" disabled={saving || lockReason.trim().length < 2}>
                    {saving ? "Đang khóa..." : "Xác nhận khóa"}
                  </DsButton>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {slot.status === "LOCKED" ? (
                  <DsButton variant="primary" onClick={unlock}>
                    Mở khóa
                  </DsButton>
                ) : (
                  <DsButton onClick={() => { setLockOpen(true); setLockReason(slot.lockReason || ""); }}>Khóa khung giờ</DsButton>
                )}
                {canWrite && slot.status !== "AVAILABLE" ? <DsButton onClick={() => setStatusTo("AVAILABLE")}>Đặt lại còn trống</DsButton> : null}
                {canWrite && slot.status !== "CANCELLED" ? <DsButton onClick={() => setStatusTo("CANCELLED")}>Huỷ khung giờ</DsButton> : null}
              </div>
            )}
            {canWrite ? (
              <div>
                  <DsButton variant="ghost" onClick={() => void askDelete()}>
                    Xoá khung giờ
                  </DsButton>
                </div>
            ) : null}
          </>
        )}
      </div>
    </DsEditDialog>
  );
}

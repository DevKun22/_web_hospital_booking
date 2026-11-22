"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsButton, DsDialog, DsField, DsTextarea } from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import { formatVietnamDate } from "@/lib/date";
import { usePublicAvailableSlots } from "@/lib/public-slots-query";
import type { Appointment } from "@/lib/types";
import { today } from "./appointment-model";

// Hộp thoại đổi lịch hẹn: chọn ngày và khung giờ còn trống của cùng bác sĩ, kèm lý do. Giữ trạng thái riêng nên mở lần mới luôn bắt đầu từ ngày hẹn hiện tại.

export function RescheduleDialog({
  appointment,
  onClose,
  onRescheduled,
  onNotice,
  onError,
  invalidate,
}: {
  appointment: Appointment;
  onClose: () => void;
  onRescheduled: (updated: Appointment) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidate: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(appointment.appointmentDate.slice(0, 10));
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const slotsQuery = usePublicAvailableSlots({ doctorId: appointment.doctor.id, date });
  const reasonValid = reason.trim().length >= 2;

  const submit = async () => {
    if (!slotId) {
      onError("Vui lòng chọn khung giờ mới");
      return;
    }
    if (!reasonValid) {
      onError("Vui lòng nhập lý do đổi lịch");
      return;
    }
    setBusy(true);
    onError("");
    onNotice("");
    try {
      const updated = await apiRequest<Appointment>(`/dashboard/appointments/${appointment.id}/reschedule`, {
        method: "PATCH",
        body: { timeSlotId: slotId, reason: reason.trim() },
      });
      onRescheduled(updated);
      onNotice(`Đã đổi lịch sang ${formatVietnamDate(updated.appointmentDate)} lúc ${updated.startTime}`);
      onClose();
      await Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ["public", "available-slots"] })]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không đổi được lịch hẹn");
      await slotsQuery.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Đổi lịch hẹn"
      description="Giữ nguyên bác sĩ và thông tin khám; hệ thống phát hành mã lịch mới, giải phóng khung giờ cũ và gửi thông báo cho người khám."
      size="lg"
      footer={
        <>
          <DsButton onClick={onClose}>Đóng</DsButton>
          <DsButton
            variant="primary"
            disabled={busy || !slotId || !reasonValid}
            title={!slotId ? "Chọn khung giờ mới" : !reasonValid ? "Nhập lý do đổi lịch" : undefined}
            onClick={() => void submit()}
          >
            {busy ? "Đang đổi lịch..." : "Xác nhận đổi lịch"}
          </DsButton>
        </>
      }
    >
      <DsField label="Ngày khám mới" htmlFor="reschedule-date">
        <VietnamDateInput
          value={date}
          min={today()}
          ariaLabel="Ngày khám mới"
          onChange={(value) => {
            setDate(value);
            setSlotId("");
          }}
          className="ds-input"
          required
        />
      </DsField>
      <div>
        <strong style={{ fontSize: 13 }}>Khung giờ còn trống</strong>
        {slotsQuery.isLoading || slotsQuery.isFetching ? (
          <p className="ds-hint">Đang cập nhật khung giờ...</p>
        ) : slotsQuery.isError ? (
          <p>
            <DsButton onClick={() => void slotsQuery.refetch()}>Không tải được khung giờ. Thử lại</DsButton>
          </p>
        ) : (slotsQuery.data?.length || 0) === 0 ? (
          <p className="ds-hint">Bác sĩ chưa còn khung giờ trống trong ngày này.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginTop: 8 }}>
            {slotsQuery.data?.map((slot) => (
              <DsButton key={slot.id} variant={slotId === slot.id ? "primary" : "default"} aria-pressed={slotId === slot.id} onClick={() => setSlotId(slot.id)}>
                {slot.startTime} - {slot.endTime}
              </DsButton>
            ))}
          </div>
        )}
      </div>
      <DsField label="Lý do đổi lịch" htmlFor="reschedule-reason" required>
        <DsTextarea id="reschedule-reason" rows={2} value={reason} placeholder="Ví dụ: bác sĩ thay đổi lịch làm việc" onChange={(event) => setReason(event.target.value)} />
      </DsField>
    </DsDialog>
  );
}

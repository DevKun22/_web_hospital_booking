"use client";

import { useState } from "react";
import { DsButton, DsDialog, DsField, DsTextarea } from "@/components/ds";

// Hộp thoại hủy lịch hẹn: giữ lý do hủy riêng, việc gọi máy chủ do trang cha làm (onConfirm trả true khi hủy xong thì hộp tự đóng).
export function CancelAppointmentDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 2;

  const submit = async () => {
    if (!valid) return;
    if (await onConfirm(reason.trim())) onClose();
  };

  return (
    <DsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Hủy lịch hẹn"
      description="Lịch hẹn được hủy và khung giờ được giải phóng; người khám sẽ nhận thông báo."
      size="md"
      footer={
        <>
          <DsButton onClick={onClose}>Giữ lịch</DsButton>
          <DsButton variant="danger" disabled={busy || !valid} onClick={() => void submit()}>
            Xác nhận hủy
          </DsButton>
        </>
      }
    >
      <DsField label="Lý do hủy" htmlFor="cancel-reason" required>
        <DsTextarea id="cancel-reason" rows={3} value={reason} placeholder="Ví dụ: người khám yêu cầu hủy lịch" onChange={(event) => setReason(event.target.value)} />
      </DsField>
    </DsDialog>
  );
}

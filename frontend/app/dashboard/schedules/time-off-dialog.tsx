"use client";

import { useState } from "react";
import { DsButton, DsEditDialog, DsField, DsInput, DsNotice, DsSelect } from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import { formatVietnamDate } from "@/lib/date";
import type { DoctorProfile } from "@/lib/types";
import { doctorName, today, type RangeResult } from "./schedule-model";

// Nghỉ phép, họp, việc đột xuất: đóng (hoặc mở lại) mọi khung giờ trống của bác sĩ trong khoảng ngày. Bác sĩ chỉ thao tác trên lịch của chính mình.

export function TimeOffDialog({
  doctors,
  isDoctor,
  ownDoctorId,
  onClose,
  onNotice,
  onError,
  invalidateSlots,
}: {
  doctors: DoctorProfile[];
  isDoctor: boolean;
  ownDoctorId: string;
  onClose: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidateSlots: () => Promise<void>;
}) {
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RangeResult | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async (kind: "close" | "reopen") => {
    const targetDoctorId = isDoctor ? ownDoctorId : doctorId;
    if (!targetDoctorId) {
      onError(isDoctor ? "Chưa có lịch mẫu nào gắn với tài khoản bác sĩ của bạn" : "Chọn bác sĩ");
      return;
    }
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const response = await apiRequest<RangeResult>(`/dashboard/doctor-time-slots/${kind === "close" ? "close-range" : "reopen-range"}`, {
        method: "POST",
        body: kind === "close" ? { doctorId: targetDoctorId, from, to, reason: reason.trim() } : { doctorId: targetDoctorId, from, to },
      });
      setResult(response);
      onNotice(
        kind === "close"
          ? `Đã đóng ${response.lockedSlots ?? 0} khung giờ trống.${response.affected?.length ? ` Có ${response.affected.length} lịch đã đặt cần liên hệ người khám (nhân viên đã được báo).` : ""}`
          : `Đã mở lại ${response.reopenedSlots ?? 0} khung giờ.`,
      );
      await invalidateSlots();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xử lý được khoảng ngày");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsEditDialog size="lg" title="Nghỉ phép / đóng lịch" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <p className="ds-hint" style={{ margin: 0 }}>
          Đóng mọi khung giờ còn trống của bác sĩ trong khoảng ngày (nghỉ phép, họp, việc đột xuất). Lịch đã đặt không bị hủy: hệ thống liệt kê để nhân viên liên hệ người khám đổi lịch.
        </p>
        {isDoctor ? null : (
          <DsField label="Bác sĩ" htmlFor="off-doctor" required>
            <DsSelect id="off-doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
              <option value="">Chọn bác sĩ</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctorName(doctor)}
                </option>
              ))}
            </DsSelect>
          </DsField>
        )}
        <div className="ds-grid-fields">
          <DsField label="Từ ngày">
            <VietnamDateInput value={from} onChange={(value) => { setFrom(value); if (value > to) setTo(value); }} required ariaLabel="Nghỉ từ ngày" className="ds-input" />
          </DsField>
          <DsField label="Đến ngày">
            <VietnamDateInput value={to} onChange={setTo} required ariaLabel="Nghỉ đến ngày" className="ds-input" />
          </DsField>
        </div>
        <DsField label="Lý do" htmlFor="off-reason" hint="Hiện cho nhân viên và nhật ký, ví dụ: Nghỉ phép năm, Họp chuyên môn">
          <DsInput id="off-reason" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
        </DsField>
        <div className="ds-form-actions">
          <DsButton disabled={saving} onClick={() => void run("reopen")}>
            Mở lại khoảng này
          </DsButton>
          <DsButton variant="primary" disabled={saving || reason.trim().length < 2 || !from || !to} onClick={() => void run("close")}>
            {saving ? "Đang xử lý..." : "Đóng lịch"}
          </DsButton>
        </div>
        {result?.affected?.length ? (
          <DsNotice tone="warn">
            <div style={{ display: "grid", gap: 6 }}>
              <strong>{result.affected.length} lịch đã đặt cần liên hệ người khám</strong>
              {result.affected.slice(0, 10).map((item) => (
                <span key={item.appointmentId} className="ds-mono">
                  {item.bookingCode} · {item.patientName} · {formatVietnamDate(item.date)} {item.startTime}
                </span>
              ))}
              {result.affected.length > 10 ? <span>Và {result.affected.length - 10} lịch khác. Xem đầy đủ ở trang Lịch hẹn.</span> : null}
            </div>
          </DsNotice>
        ) : null}
      </div>
    </DsEditDialog>
  );
}

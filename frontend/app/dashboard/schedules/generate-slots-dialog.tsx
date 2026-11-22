"use client";

import { FormEvent, useState } from "react";
import { DsButton, DsEditDialog, DsField, DsSelect } from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import type { DoctorProfile } from "@/lib/types";
import { addDaysToInput, doctorName, today } from "./schedule-model";

// Hộp thoại sinh khung giờ theo khoảng ngày cho một bác sĩ. Trạng thái riêng nên mở lần mới luôn về mặc định 14 ngày.

export function GenerateSlotsDialog({
  doctors,
  onClose,
  onGenerated,
  onNotice,
  onError,
  invalidateSlots,
}: {
  doctors: DoctorProfile[];
  onClose: () => void;
  onGenerated: (range: { doctorId: string; from: string }) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidateSlots: () => Promise<void>;
}) {
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDaysToInput(today(), 13));
  const [saving, setSaving] = useState(false);

  const setRangeDays = (days: number) => {
    setFrom(today());
    setTo(addDaysToInput(today(), days - 1));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const result = await apiRequest<{ generatedCount: number; days: number }>("/dashboard/doctor-time-slots/generate-range", {
        method: "POST",
        body: { doctorId, from, to },
      });
      onGenerated({ doctorId, from });
      onNotice(result.generatedCount ? `Đã sinh ${result.generatedCount} khung giờ trong ${result.days} ngày.` : `Không có khung giờ mới: các ngày này đã có đủ khung giờ.`);
      onClose();
      await invalidateSlots();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo được khung giờ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsEditDialog size="lg" title="Sinh khung giờ" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }} aria-label="Sinh khung giờ theo khoảng ngày">
        <p className="ds-hint" style={{ margin: 0 }}>
          Hệ thống đã tự sinh khung giờ cho 14 ngày tới. Dùng công cụ này khi cần mở xa hơn (tối đa 62 ngày một lần). Không tạo trùng khung giờ có sẵn.
        </p>
        <DsField label="Bác sĩ" htmlFor="gen-doctor" required>
          <DsSelect id="gen-doctor" value={doctorId} required onChange={(event) => setDoctorId(event.target.value)}>
            <option value="">Chọn bác sĩ</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctorName(doctor)}
              </option>
            ))}
          </DsSelect>
        </DsField>
        <div className="ds-grid-fields">
          <DsField label="Từ ngày">
            <VietnamDateInput value={from} onChange={setFrom} required ariaLabel="Từ ngày" className="ds-input" />
          </DsField>
          <DsField label="Đến ngày">
            <VietnamDateInput value={to} onChange={setTo} required ariaLabel="Đến ngày" className="ds-input" />
          </DsField>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[7, 14, 30].map((days) => (
            <DsButton key={days} onClick={() => setRangeDays(days)}>
              {days} ngày tới
            </DsButton>
          ))}
        </div>
        <div className="ds-form-actions">
          <DsButton onClick={onClose}>Đóng</DsButton>
          <DsButton type="submit" variant="primary" disabled={saving || !doctorId || !from || !to}>
            {saving ? "Đang sinh..." : "Sinh khung giờ"}
          </DsButton>
        </div>
      </form>
    </DsEditDialog>
  );
}

"use client";

import { type FormEvent, useState } from "react";
import { DsButton, DsDialog, DsField, DsInput, DsSelect, DsTextarea } from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import { getVietnamYesterdayDateInput } from "@/lib/date";
import type { Appointment } from "@/lib/types";
import { buildPatientInfoForm, buildPatientInfoPayload, type PatientInfoForm } from "./appointment-model";

// Hộp thoại cập nhật thông tin tiếp nhận (hồ sơ người khám và BHYT) trước khi phát hành hóa đơn. Biểu mẫu dựng từ lịch hẹn lúc mở nên luôn mới.

export function PatientInfoDialog({
  appointment,
  onClose,
  onSaved,
  onNotice,
  onError,
  invalidate,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSaved: (updated: Appointment) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  invalidate: () => Promise<void>;
}) {
  const [form, setForm] = useState<PatientInfoForm>(() => buildPatientInfoForm(appointment));
  const [busy, setBusy] = useState(false);

  const setField = <K extends keyof PatientInfoForm>(key: K, value: PatientInfoForm[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "hasBHYT" && value === false) {
        next.healthInsuranceCode = "";
        next.registeredHospital = "";
      }
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.hasBHYT && !form.healthInsuranceCode.trim()) {
      onError("Vui lòng nhập mã thẻ BHYT");
      return;
    }
    setBusy(true);
    onError("");
    onNotice("");
    try {
      const updated = await apiRequest<Appointment>(`/dashboard/appointments/${appointment.id}/patient-info`, {
        method: "PATCH",
        body: buildPatientInfoPayload(form),
      });
      onSaved(updated);
      onNotice("Đã cập nhật thông tin tiếp nhận");
      onClose();
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được thông tin tiếp nhận");
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
      title="Thông tin tiếp nhận"
      description="Dùng để xác minh thông tin người khám và BHYT trước khi phát hành hóa đơn."
      size="lg"
      footer={
        <>
          <DsButton onClick={onClose}>Đóng</DsButton>
          <DsButton type="submit" form="pi-form" variant="primary" loading={busy}>
            {busy ? "Đang lưu..." : "Lưu thông tin"}
          </DsButton>
        </>
      }
    >
      <form id="pi-form" onSubmit={submit} aria-label="Thông tin tiếp nhận" className="ds-dialog__form">
        <DsField label="Họ tên người khám" htmlFor="pi-name" required>
          <DsInput id="pi-name" value={form.patientName} required onChange={(event) => setField("patientName", event.target.value)} />
        </DsField>
        <div className="ds-grid-fields">
          <DsField label="Email" htmlFor="pi-email">
            <DsInput id="pi-email" type="email" value={form.patientEmail} onChange={(event) => setField("patientEmail", event.target.value)} />
          </DsField>
          <DsField label="Giới tính" htmlFor="pi-gender">
            <DsSelect id="pi-gender" value={form.gender} onChange={(event) => setField("gender", event.target.value as PatientInfoForm["gender"])}>
              <option value="">Chưa cập nhật</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </DsSelect>
          </DsField>
          <DsField label="Ngày sinh" htmlFor="pi-dob">
            <VietnamDateInput value={form.dateOfBirth} max={getVietnamYesterdayDateInput()} ariaLabel="Ngày sinh người khám" onChange={(value) => setField("dateOfBirth", value)} className="ds-input" />
          </DsField>
          <DsField label="Căn cước công dân" htmlFor="pi-cccd">
            <DsInput id="pi-cccd" value={form.cccd} onChange={(event) => setField("cccd", event.target.value)} />
          </DsField>
        </div>
        <DsField label="Địa chỉ" htmlFor="pi-address">
          <DsInput id="pi-address" value={form.address} onChange={(event) => setField("address", event.target.value)} />
        </DsField>
        <label className="ds-check" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={form.hasBHYT} onChange={(event) => setField("hasBHYT", event.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <strong>Người khám có BHYT</strong>
            <small style={{ display: "block", color: "var(--ds-muted)" }}>Tắt mục này sẽ đặt giảm trừ BHYT về 0.</small>
          </span>
        </label>
        {form.hasBHYT ? (
          <div className="ds-grid-fields">
            <DsField label="Mã thẻ BHYT" htmlFor="pi-bhyt" required>
              <DsInput id="pi-bhyt" value={form.healthInsuranceCode} required onChange={(event) => setField("healthInsuranceCode", event.target.value)} />
            </DsField>
            <DsField label="Nơi đăng ký khám chữa bệnh" htmlFor="pi-hospital">
              <DsInput id="pi-hospital" value={form.registeredHospital} onChange={(event) => setField("registeredHospital", event.target.value)} />
            </DsField>
          </div>
        ) : null}
        <DsField label="Dị ứng" htmlFor="pi-allergies">
          <DsTextarea id="pi-allergies" rows={2} value={form.allergies} onChange={(event) => setField("allergies", event.target.value)} />
        </DsField>
        <DsField label="Tiền sử bệnh" htmlFor="pi-history">
          <DsTextarea id="pi-history" rows={2} value={form.medicalHistory} onChange={(event) => setField("medicalHistory", event.target.value)} />
        </DsField>
        <DsField label="Tiền sử gia đình" htmlFor="pi-family">
          <DsTextarea id="pi-family" rows={2} value={form.familyHistory} onChange={(event) => setField("familyHistory", event.target.value)} />
        </DsField>
      </form>
    </DsDialog>
  );
}

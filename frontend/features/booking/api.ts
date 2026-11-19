import { apiRequest } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-portal-api";
import type { PatientUser } from "@/lib/patient-portal-types";
import type { Appointment } from "@/lib/types";
import type { BookingDraft, BookingSelection, PendingAppointment } from "@/features/booking/model";
import { hasHealthDeclaration } from "@/features/booking/model";

const orNull = (value: string) => value.trim() || null;

// Giữ chỗ khung giờ và gửi OTP. Chỉ thành công thật khi server trả về phiếu.
export function createAppointment(selection: BookingSelection, draft: BookingDraft, terms?: { termsAccepted: boolean; termsVersion: string }) {
  return apiRequest<PendingAppointment>("/appointments", {
    method: "POST",
    body: {
      packageId: selection.packageId || null,
      departmentId: selection.departmentId,
      doctorId: selection.doctorId,
      timeSlotId: draft.timeSlotId,
      patientName: draft.patientName.trim(),
      patientPhone: draft.patientPhone.trim(),
      patientEmail: draft.patientEmail.trim().toLowerCase(),
      reason: orNull(draft.reason),
      gender: draft.gender || null,
      dateOfBirth: draft.dateOfBirth || null,
      cccd: orNull(draft.cccd),
      address: orNull(draft.address),
      hasBHYT: draft.hasBHYT,
      healthInsuranceCode: orNull(draft.healthInsuranceCode),
      registeredHospital: orNull(draft.registeredHospital),
      allergies: orNull(draft.allergies),
      medicalHistory: orNull(draft.medicalHistory),
      familyHistory: orNull(draft.familyHistory),
      healthConsent: hasHealthDeclaration(draft) ? draft.healthConsent : undefined,
      ...terms,
    },
  });
}

// Đi qua route handler của Next để máy chủ đặt cookie phiên người khám; user là null nếu không cấp được phiên.
export const verifyAppointmentOtp = async (appointmentId: string, otp: string) =>
  (
    await patientApiRequest<{ appointment: Appointment; user: PatientUser | null }>("/dat-lich/xac-thuc", {
      method: "POST",
      body: JSON.stringify({ appointmentId, otp }),
    })
  ).data;

export type ResendOtpResult = {
  expiresIn: number;
  otpDeliveryStatus?: PendingAppointment["otpDeliveryStatus"];
  debugOtp?: string;
  holdExpiresAt?: string | null;
};

export const resendAppointmentOtp = (appointmentId: string) =>
  apiRequest<ResendOtpResult>(`/appointments/${appointmentId}/resend-otp`, { method: "POST" });

// Trả khung giờ đang giữ. Không có token thì chỉ cần bỏ phiếu phía trình duyệt.
export const releaseAppointmentHold = (pending: PendingAppointment) =>
  pending.holdReleaseToken
    ? apiRequest(`/appointments/${pending.appointmentId}/pending`, {
        method: "DELETE",
        body: { holdReleaseToken: pending.holdReleaseToken },
      })
    : Promise.resolve(null);

import { getVietnamDateInput } from "@/lib/date";
import type { Appointment, AppointmentStatus, DoctorProfile } from "@/lib/types";

// Lịch hẹn: nhãn, biểu mẫu thông tin người khám và phép chuyển đổi tách khỏi trang.

export const today = () => getVietnamDateInput();

export const doctorName = (doctor: DoctorProfile | Appointment["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

export const isCancelled = (status: AppointmentStatus) => status.startsWith("CANCELLED");

export type PatientInfoForm = {
  patientName: string;
  patientEmail: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  cccd: string;
  address: string;
  hasBHYT: boolean;
  healthInsuranceCode: string;
  registeredHospital: string;
  allergies: string;
  medicalHistory: string;
  familyHistory: string;
};

export const emptyPatientInfoForm: PatientInfoForm = {
  patientName: "",
  patientEmail: "",
  gender: "",
  dateOfBirth: "",
  cccd: "",
  address: "",
  hasBHYT: false,
  healthInsuranceCode: "",
  registeredHospital: "",
  allergies: "",
  medicalHistory: "",
  familyHistory: "",
};

export const toDateInputValue = (value: string | null) => (value ? value.slice(0, 10) : "");

export const buildPatientInfoForm = (appointment: Appointment): PatientInfoForm => ({
  patientName: appointment.patientName,
  patientEmail: appointment.patientEmail || "",
  gender: appointment.patientGender || "",
  dateOfBirth: toDateInputValue(appointment.patientDateOfBirth),
  cccd: appointment.patientCccd || "",
  address: appointment.patientAddress || "",
  hasBHYT: appointment.hasBHYT,
  healthInsuranceCode: appointment.healthInsuranceCode || "",
  registeredHospital: appointment.registeredHospital || "",
  allergies: appointment.allergies || "",
  medicalHistory: appointment.medicalHistory || "",
  familyHistory: appointment.familyHistory || "",
});

export const canEditPatientInfoStatus = (status: AppointmentStatus) =>
  ["PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status);

// Các trạng thái hiếm gặp gom vào một ô chọn để dãy tab gọn.
export const otherStatuses: { value: AppointmentStatus; label: string }[] = [
  { value: "PENDING_OTP", label: "Chờ mã xác thực" },
  { value: "RESCHEDULED", label: "Đã đổi lịch" },
  { value: "NO_SHOW", label: "Không đến" },
  { value: "CANCELLED_BY_PATIENT", label: "Người khám hủy" },
  { value: "CANCELLED_BY_DOCTOR", label: "Bác sĩ hủy" },
  { value: "CANCELLED_BY_ADMIN", label: "Quản trị hủy" },
];

// "Cần xử lý" là hàng đợi mặc định: ca đang khám, người đã đến chờ, lịch đã xác nhận, lịch chờ xác nhận theo thứ tự ưu tiên.
export const ACTIVE_TAB = "ACTIVE";
export const mainStatusTabs = [
  { id: ACTIVE_TAB, label: "Cần xử lý" },
  { id: "all", label: "Tất cả" },
  { id: "PENDING_CONFIRM", label: "Chờ xác nhận" },
  { id: "CONFIRMED", label: "Đã xác nhận" },
  { id: "CHECKED_IN", label: "Đã tiếp nhận" },
  { id: "IN_PROGRESS", label: "Đang khám" },
  { id: "COMPLETED", label: "Hoàn thành" },
];

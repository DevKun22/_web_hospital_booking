import type { Appointment, DoctorProfile, MedicalPackage } from "@/lib/types";
import type { PublicDepartment } from "@/components/public/public-home-types";
import type { PublicSlot } from "@/lib/public-slots-query";

export type BookingStep = "service" | "schedule" | "details" | "verify" | "done";
export type ServiceMode = "" | "DOCTOR_ONLY" | "PACKAGE";
export type OtpChannel = "SMS" | "EMAIL";

export type BookingSelection = {
  departmentId: string;
  doctorId: string;
  packageId: string;
  serviceMode: ServiceMode;
};

export type BookingDraft = {
  date: string;
  timeSlotId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  otpChannel: OtpChannel;
  reason: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  address: string;
  cccd: string;
  hasBHYT: boolean;
  healthInsuranceCode: string;
  registeredHospital: string;
  allergies: string;
  medicalHistory: string;
  familyHistory: string;
  // Đồng ý cho bệnh viện lưu thông tin sức khỏe; bắt buộc khi có khai báo ở trên.
  healthConsent: boolean;
};

// Lịch đã được giữ chỗ, đang chờ xác thực OTP.
export type PendingAppointment = {
  appointmentId: string;
  bookingCode: string;
  patientPhone: string;
  otpDeliveryStatus?: "PENDING" | "SENT" | "FAILED";
  debugOtp?: string;
  expiresIn: number;
  holdExpiresAt?: string | null;
  holdReleaseToken?: string;
  // Lựa chọn tại thời điểm giữ chỗ, để khôi phục phiếu tóm tắt sau khi tải lại trang.
  snapshot?: { selection: BookingSelection; slot: BookingSlot | null };
};

export type BookingSlot = PublicSlot;

export type BookingState = {
  step: BookingStep;
  selection: BookingSelection;
  draft: BookingDraft;
  // Khung giờ đang chọn (giữ cả giờ để phiếu tóm tắt vẫn hiển thị khi khung giờ đã được giữ chỗ).
  slot: BookingSlot | null;
  // Tài khoản đã được dùng để tự điền thông tin (tránh tự điền lại / lẫn người).
  profileOwnerId: string | null;
  pending: PendingAppointment | null;
  verified: Appointment | null;
  otp: string;
  // Thời điểm (ms) được phép gửi lại OTP; 0 khi không có phiếu chờ.
  resendAt: number;
  submitting: boolean;
  notice: string;
  error: string;
  // Đã áp dụng tham số trên URL (doctorId, packageId, ...) một lần.
  urlApplied: boolean;
};

export type BookingCatalog = {
  departments: PublicDepartment[];
  doctors: DoctorProfile[];
  packages: MedicalPackage[];
};

export const STEP_ORDER: readonly Exclude<BookingStep, "done">[] = ["service", "schedule", "details", "verify"];

// Bước hiển thị trên thanh tiến trình: "done" vẫn nằm ở bước xác thực cuối cùng.
export const stepIndex = (step: BookingStep) => (step === "done" ? STEP_ORDER.length - 1 : STEP_ORDER.indexOf(step));

export const todayInVietnam = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

export const initialSelection: BookingSelection = {
  departmentId: "",
  doctorId: "",
  packageId: "",
  serviceMode: "",
};

// Ngày mặc định để rỗng khi dựng giao diện trên máy chủ; trình duyệt điền ngày hôm nay sau khi tải (tránh lệch khi hydrate).
export const createInitialDraft = (date = ""): BookingDraft => ({
  date,
  timeSlotId: "",
  patientName: "",
  patientPhone: "",
  patientEmail: "",
  otpChannel: "EMAIL",
  reason: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  cccd: "",
  hasBHYT: false,
  healthInsuranceCode: "",
  registeredHospital: "",
  allergies: "",
  medicalHistory: "",
  familyHistory: "",
  healthConsent: false,
});

export const createInitialState = (): BookingState => ({
  step: "service",
  selection: initialSelection,
  draft: createInitialDraft(),
  slot: null,
  profileOwnerId: null,
  pending: null,
  verified: null,
  otp: "",
  resendAt: 0,
  submitting: false,
  notice: "",
  error: "",
  urlApplied: false,
});

export { doctorDisplayName } from "@/lib/doctor";

export const hasHealthDeclaration = (draft: BookingDraft) =>
  Boolean(draft.allergies.trim() || draft.medicalHistory.trim() || draft.familyHistory.trim());

export const doctorsFor = (catalog: BookingCatalog, departmentId: string) =>
  departmentId ? catalog.doctors.filter((item) => item.department.id === departmentId) : catalog.doctors;

export const packagesFor = (catalog: BookingCatalog, departmentId: string) =>
  departmentId
    ? catalog.packages.filter((item) => !item.department?.id || item.department.id === departmentId)
    : catalog.packages;

// Giá tạm tính: theo gói khi chọn gói, theo phí khám của bác sĩ khi khám theo bác sĩ.
export const estimateAmount = (selection: BookingSelection, catalog: BookingCatalog) => {
  if (selection.serviceMode === "PACKAGE") {
    return catalog.packages.find((item) => item.id === selection.packageId)?.finalPrice || 0;
  }
  if (selection.serviceMode === "DOCTOR_ONLY") {
    return catalog.doctors.find((item) => item.id === selection.doctorId)?.consultationFee || 0;
  }
  return 0;
};

import { hasHealthDeclaration, type BookingDraft, type BookingSelection } from "@/features/booking/model";

const PHONE_PATTERN = /^(0|\+84)[0-9]{9,10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidPhone = (value: string) => PHONE_PATTERN.test(value.trim());

// Chỉ giữ chữ số (và dấu + đầu), tối đa 11 hoặc 12 ký tự.
export const sanitizePhoneInput = (value: string) => {
  const trimmed = value.trim();
  const keepPlus = trimmed.startsWith("+") ? "+" : "";
  return `${keepPlus}${trimmed.replace(/\D/g, "")}`.slice(0, keepPlus ? 12 : 11);
};

// Mỗi hàm trả về thông báo lỗi tiếng Việt, hoặc chuỗi rỗng khi hợp lệ.
export const validateService = (selection: BookingSelection) => {
  if (!selection.departmentId) return "Vui lòng chọn chuyên khoa.";
  if (!selection.serviceMode) return "Vui lòng chọn khám theo bác sĩ hoặc một gói khám.";
  if (selection.serviceMode === "PACKAGE" && !selection.packageId) return "Vui lòng chọn gói khám phù hợp.";
  if (!selection.doctorId) return "Vui lòng chọn bác sĩ.";
  return "";
};

export const validateSchedule = (draft: BookingDraft, today: string) => {
  if (!draft.date) return "Vui lòng chọn ngày khám.";
  if (draft.date < today) return "Ngày khám không được nhỏ hơn ngày hiện tại.";
  if (!draft.timeSlotId) return "Vui lòng chọn khung giờ khám.";
  return "";
};

// Các ô ở bước thông tin có kiểm tra riêng; mỗi ô trả thông báo gắn đúng tại ô đó.
export type DetailField = "patientName" | "patientEmail" | "patientPhone" | "dateOfBirth" | "healthInsuranceCode" | "healthConsent";
export type DetailErrors = Partial<Record<DetailField, string>>;

export const validateDetailFields = (draft: BookingDraft, today: string): DetailErrors => {
  const errors: DetailErrors = {};
  if (draft.patientName.trim().length < 2) errors.patientName = "Nhập họ tên người khám, tối thiểu 2 ký tự.";
  // Email là định danh của người khám: nhận mã OTP và dùng để đăng nhập xem lại lịch hẹn.
  const email = draft.patientEmail.trim();
  if (!email) errors.patientEmail = "Nhập email để nhận mã OTP và xem lại lịch hẹn.";
  else if (!EMAIL_PATTERN.test(email)) errors.patientEmail = "Email chưa đúng định dạng.";
  const phone = draft.patientPhone.trim();
  if (!phone) errors.patientPhone = "Nhập số điện thoại để cơ sở khám liên hệ.";
  else if (!isValidPhone(phone)) errors.patientPhone = "Số điện thoại bắt đầu bằng 0 hoặc +84 và có 10 hoặc 11 số.";
  if (draft.dateOfBirth && draft.dateOfBirth >= today) errors.dateOfBirth = "Ngày sinh phải trước ngày hôm nay.";
  if (draft.hasBHYT && !draft.healthInsuranceCode.trim()) errors.healthInsuranceCode = "Nhập mã thẻ BHYT hoặc bỏ chọn có bảo hiểm.";
  if (hasHealthDeclaration(draft) && !draft.healthConsent) {
    errors.healthConsent = "Đồng ý cho lưu thông tin sức khỏe đã khai, hoặc xóa phần dị ứng và tiền sử.";
  }
  return errors;
};

export const validateDetails = (draft: BookingDraft, today: string) => Object.values(validateDetailFields(draft, today))[0] ?? "";

export const validateOtp = (otp: string) => (/^[0-9]{6}$/.test(otp) ? "" : "Mã OTP gồm đúng 6 chữ số.");

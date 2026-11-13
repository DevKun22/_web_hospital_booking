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

export const validateDetails = (draft: BookingDraft, today: string) => {
  if (draft.patientName.trim().length < 2) return "Họ tên người khám tối thiểu 2 ký tự.";
  if (!isValidPhone(draft.patientPhone)) return "Số điện thoại không hợp lệ.";
  const email = draft.patientEmail.trim();
  if (email && !EMAIL_PATTERN.test(email)) return "Email không hợp lệ.";
  if (draft.otpChannel === "EMAIL" && !email) return "Email là bắt buộc khi xác thực OTP qua email.";
  if (draft.dateOfBirth && draft.dateOfBirth >= today) return "Ngày sinh phải nhỏ hơn ngày hiện tại.";
  if (draft.hasBHYT && !draft.healthInsuranceCode.trim()) return "Vui lòng nhập mã thẻ BHYT.";
  if (hasHealthDeclaration(draft) && !draft.healthConsent) {
    return "Vui lòng đồng ý cho bệnh viện lưu thông tin sức khỏe bạn đã khai báo, hoặc xóa phần dị ứng và tiền sử.";
  }
  return "";
};

export const validateOtp = (otp: string) => (/^[0-9]{6}$/.test(otp) ? "" : "OTP phải gồm đúng 6 chữ số.");

// Kiểm tra toàn bộ trước khi gửi: lỗi đầu tiên theo thứ tự các bước.
export const validateBooking = (selection: BookingSelection, draft: BookingDraft, today: string) =>
  validateService(selection) || validateSchedule(draft, today) || validateDetails(draft, today);

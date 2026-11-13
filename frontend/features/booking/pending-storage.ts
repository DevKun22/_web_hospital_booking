import type { PendingAppointment } from "@/features/booking/model";

const STORAGE_KEY = "hospital-public-pending-appointment";

// Phiếu chờ OTP được giữ trong sessionStorage để người dùng tải lại trang vẫn xác thực tiếp được.
export function readPendingAppointment(): PendingAppointment | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null") as Partial<PendingAppointment> | null;
    if (!value?.appointmentId || !value.bookingCode || !value.patientPhone || typeof value.expiresIn !== "number") {
      return null;
    }
    return value as PendingAppointment;
  } catch {
    return null;
  }
}

export function writePendingAppointment(value: PendingAppointment) {
  if (typeof window === "undefined") return;
  try {
    // Không lưu OTP debug: mã chỉ hiển thị từ phản hồi hiện tại ở môi trường phát triển.
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, debugOtp: undefined }));
  } catch {
    // Trình duyệt chặn lưu trữ: bỏ qua, luồng đặt lịch vẫn chạy bình thường.
  }
}

export function clearPendingAppointment() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Bỏ qua như trên.
  }
}

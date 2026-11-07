export type PublicPendingAppointment = {
  appointmentId: string;
  bookingCode: string;
  patientPhone: string;
  otpDeliveryStatus?: "PENDING" | "SENT" | "FAILED";
  debugOtp?: string;
  expiresIn: number;
  holdExpiresAt?: string | null;
  holdReleaseToken?: string;
};

const storageKey = "hospital-public-pending-appointment";

export const readPublicPendingAppointment = () => {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(storageKey) || "null",
    ) as Partial<PublicPendingAppointment> | null;

    if (
      !value?.appointmentId ||
      !value.bookingCode ||
      !value.patientPhone ||
      typeof value.expiresIn !== "number"
    ) {
      return null;
    }

    return value as PublicPendingAppointment;
  } catch {
    return null;
  }
};

export const writePublicPendingAppointment = (
  value: PublicPendingAppointment,
) => {
  if (typeof window === "undefined") return;

  // Không lưu OTP debug vào sessionStorage. Mã chỉ được hiển thị từ phản hồi
  // hiện tại trong môi trường phát triển.
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ ...value, debugOtp: undefined }),
  );
};

export const clearPublicPendingAppointment = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey);
};

// Sao chép mã lịch; nếu trình duyệt không cho phép thì hiện mã để người dùng tự chép.
export async function copyBookingCode(bookingCode: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(bookingCode);
    notify("Đã sao chép mã lịch. Vui lòng lưu lại để tra cứu hoặc xác thực sau.");
  } catch {
    notify(`Mã lịch của bạn là ${bookingCode}. Vui lòng lưu lại để tra cứu hoặc xác thực sau.`);
  }
}

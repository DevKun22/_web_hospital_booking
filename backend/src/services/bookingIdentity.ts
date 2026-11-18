// Quy tắc định danh khi đặt lịch. Email là định danh duy nhất của tài khoản người khám và là nơi nhận OTP, nên người nhập đúng
// mã gửi tới email đã chứng minh sở hữu email đó; không còn trường hợp "khách đặt bằng thông tin của người khác".

/**
 * Người đã đăng nhập đặt lịch cho CHÍNH MÌNH không cần OTP đặt lịch: phiên cổng người khám
 * chỉ tồn tại sau khi qua OTP, và lịch luôn gắn email của tài khoản (xem resolveBookingIdentity).
 * Khách chưa đăng nhập và đặt cho người thân vẫn phải OTP.
 */
export const canSkipBookingOtp = (input: {
  isAuthenticated: boolean;
  dependentProfileId?: string | null;
}): boolean => input.isAuthenticated && !input.dependentProfileId;

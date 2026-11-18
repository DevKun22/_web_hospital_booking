import { AppError } from "../utils/appError.js";
import AuthAttemptService from "./authAttempt.service.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_IP = 20;

// Giới hạn dò mật khẩu đăng nhập bảng điều khiển. Dùng chung bảng AuthAttempt (kind = DASHBOARD_LOGIN) với bộ đếm OTP.
class DashboardLoginSecurityService {
  async assertAllowed(email: string, ipAddress: string) {
    const { byTarget, byIp } = await AuthAttemptService.countFailures({
      kind: "DASHBOARD_LOGIN",
      target: email,
      ipAddress,
      windowMs: WINDOW_MS,
    });

    if (byTarget >= MAX_FAILURES_PER_ACCOUNT || byIp >= MAX_FAILURES_PER_IP) {
      throw new AppError(
        "Đăng nhập tạm thời bị giới hạn. Vui lòng thử lại sau 15 phút.",
        429,
        "LOGIN_RATE_LIMITED",
      );
    }
  }

  async recordFailure(email: string, ipAddress: string) {
    await AuthAttemptService.record({ kind: "DASHBOARD_LOGIN", target: email, ipAddress, success: false });
  }

  async clearAccountFailures(email: string) {
    await AuthAttemptService.clearTarget("DASHBOARD_LOGIN", email);
  }
}

export default new DashboardLoginSecurityService();

import {
  buildAccountChangeEmailTemplate,
  type AccountChangeKind,
} from "./emailTemplates/accountChange.template.js";
import EmailService from "./email.service.js";

// Báo cho chủ tài khoản khi người khác (quản trị) đổi thông tin quyết định ai đăng nhập được:
// mật khẩu, email nhận OTP, số điện thoại, vai trò. Thư gửi tới email CŨ, vì email mới có thể
// chính là của người vừa đổi. Là biện pháp bổ sung cho nhật ký, nên lỗi gửi thư (chưa cấu hình,
// mạng) không được làm hỏng thao tác quản trị: chỉ ghi log.
class AccountChangeNoticeService {
  async notify(input: { email: string | null | undefined; changes: AccountChangeKind[] }) {
    if (!input.email || input.changes.length === 0) return false;
    try {
      const template = buildAccountChangeEmailTemplate({
        changes: input.changes,
        at: new Date(),
      });
      await EmailService.sendMail({
        to: input.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      return true;
    } catch (error) {
      console.warn(
        "[ACCOUNT_CHANGE_NOTICE] cannot send:",
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }
}

export default new AccountChangeNoticeService();

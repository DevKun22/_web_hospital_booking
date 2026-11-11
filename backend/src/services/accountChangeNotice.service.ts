import {
  buildAccountChangeEmailTemplate,
  type AccountChangeKind,
} from "./emailTemplates/accountChange.template.js";
import EmailService from "./email.service.js";

// Báo cho chủ tài khoản khi người khác (quản trị) đổi thông tin quyết định ai đăng nhập được:
// mật khẩu, email nhận OTP, số điện thoại, vai trò. Thư gửi tới email CŨ, vì email mới có thể
// chính là của người vừa đổi. Service để lỗi nổi lên cho outbox worker retry; thao tác quản trị
// đã commit độc lập vì sự kiện gửi thư được ghi bền vững trong cùng transaction.
class AccountChangeNoticeService {
  async send(input: { email: string | null | undefined; changes: AccountChangeKind[] }) {
    if (!input.email || input.changes.length === 0) return false;
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
  }
}

export default new AccountChangeNoticeService();

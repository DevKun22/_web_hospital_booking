export type AccountChangeKind =
  | "PASSWORD_RESET"
  | "EMAIL_CHANGED"
  | "PHONE_CHANGED"
  | "ROLE_CHANGED";

const changeLabel: Record<AccountChangeKind, string> = {
  PASSWORD_RESET: "Mật khẩu tài khoản đã được quản trị đặt lại; bạn sẽ phải đổi mật khẩu khi đăng nhập lại",
  EMAIL_CHANGED: "Email nhận mã đăng nhập của tài khoản đã được thay đổi",
  PHONE_CHANGED: "Số điện thoại đăng nhập của tài khoản đã được thay đổi",
  ROLE_CHANGED: "Vai trò của tài khoản đã được thay đổi",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Thư cảnh báo gửi tới email CŨ của chủ tài khoản khi thông tin đăng nhập bị người khác thay đổi.
// Không bao giờ chứa mật khẩu mới hay email, số điện thoại mới ở dạng đầy đủ.
export const buildAccountChangeEmailTemplate = (input: {
  changes: AccountChangeKind[];
  at: Date;
}) => {
  const brandName = process.env.MAIL_BRAND_NAME || "Hospital Booking";
  const time = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(input.at);
  const lines = input.changes.map((change) => changeLabel[change]);

  return {
    subject: `[${brandName}] Cảnh báo bảo mật: thông tin tài khoản vừa thay đổi`,
    text: [
      brandName,
      "",
      `Lúc ${time} (giờ Việt Nam), tài khoản dashboard của bạn có thay đổi:`,
      ...lines.map((line) => `- ${line}`),
      "",
      "Nếu bạn không biết về thay đổi này, hãy liên hệ quản trị hệ thống ngay.",
    ].join("\n"),
    html: `
      <!doctype html>
      <html lang="vi">
        <body style="margin:0;background:#f6f8fb;color:#102033;font-family:Arial,sans-serif">
          <div style="max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#fff;border:1px solid #e6eaf0;border-radius:12px;padding:24px">
              <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(brandName)}: cảnh báo bảo mật</h1>
              <p>Lúc ${escapeHtml(time)} (giờ Việt Nam), tài khoản dashboard của bạn có thay đổi:</p>
              <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
              <p>Nếu bạn không biết về thay đổi này, hãy liên hệ quản trị hệ thống ngay.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
};

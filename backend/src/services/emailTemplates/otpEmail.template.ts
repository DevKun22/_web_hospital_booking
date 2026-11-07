import type { OtpPurpose } from "../../../generated/prisma/enums.js";

type OtpEmailTemplateInput = {
  otp: string;
  purpose: OtpPurpose;
  expiresInSeconds: number;
};

const purposeLabel: Record<OtpPurpose, string> = {
  BOOK_APPOINTMENT: "xác thực đặt lịch khám",
  PATIENT_PORTAL_LOGIN: "đăng nhập cổng người khám",
  ADMIN_LOGIN: "đăng nhập dashboard admin",
  DOCTOR_LOGIN: "đăng nhập dashboard bác sĩ",
  STAFF_LOGIN: "đăng nhập dashboard nhân viên",
  PHARMACIST_LOGIN: "đăng nhập dashboard dược sĩ",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const buildOtpEmailTemplate = (input: OtpEmailTemplateInput) => {
  const brandName = process.env.MAIL_BRAND_NAME || "Hospital Booking";
  const expiresInMinutes = Math.max(Math.floor(input.expiresInSeconds / 60), 1);
  const purpose = purposeLabel[input.purpose];
  const safeBrandName = escapeHtml(brandName);
  const safePurpose = escapeHtml(purpose);
  const safeOtp = escapeHtml(input.otp);

  return {
    subject: `[${brandName}] Mã OTP xác thực`,
    text: [
      `${brandName}`,
      "",
      `Mã OTP của bạn là: ${input.otp}`,
      "",
      `Mã này dùng để ${purpose}.`,
      `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
      "Vui lòng không chia sẻ mã này cho người khác.",
      "",
      "Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.",
    ].join("\n"),
    html: `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #f6f8fb;
              color: #102033;
              font-family: Arial, sans-serif;
            }

            .email-wrapper {
              max-width: 560px;
              margin: 0 auto;
              padding: 24px;
            }

            .email-card {
              background: #ffffff;
              border: 1px solid #e6eaf0;
              border-radius: 12px;
              padding: 24px;
            }

            .email-title {
              margin: 0 0 12px;
              font-size: 22px;
              line-height: 1.3;
            }

            .email-text {
              margin: 0 0 12px;
              font-size: 15px;
              line-height: 1.6;
            }

            .otp-box {
              margin: 16px 0;
              padding: 16px;
              border-radius: 8px;
              background: #f3f6fb;
              text-align: center;
              font-size: 32px;
              line-height: 1.2;
              font-weight: 700;
              letter-spacing: 6px;
            }

            .email-muted {
              margin: 16px 0 0;
              color: #667085;
              font-size: 14px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-card">
              <h2 class="email-title">${safeBrandName}</h2>
              <p class="email-text">Mã OTP của bạn:</p>
              <div class="otp-box">${safeOtp}</div>
              <p class="email-text">Mã này dùng để ${safePurpose}.</p>
              <p class="email-text">Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong>.</p>
              <p class="email-muted">Vui lòng không chia sẻ mã này cho người khác.</p>
              <p class="email-muted">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
};

import type { OtpPurpose } from "../../generated/prisma/enums.js";
import EmailService from "./email.service.js";
import { buildOtpEmailTemplate } from "./emailTemplates/otpEmail.template.js";

type SendOtpInput = {
  email: string;
  purpose: OtpPurpose;
  otp: string;
  expiresInSeconds: number;
};

// OTP chỉ gửi qua email.
class OtpSenderService {
  async send(input: SendOtpInput) {
    const template = buildOtpEmailTemplate({
      otp: input.otp,
      purpose: input.purpose,
      expiresInSeconds: input.expiresInSeconds,
    });

    await EmailService.sendMail({
      to: input.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }
}

export default new OtpSenderService();

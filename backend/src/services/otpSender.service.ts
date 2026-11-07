import type { OtpChannel, OtpPurpose } from "../../generated/prisma/enums.js";
import {
  isDemoOtpPhone,
  isLocalOtpDebugEnabled,
  isSmsProviderConfigured,
} from "../config/otpChannels.js";
import { AppError } from "../utils/appError.js";
import EmailService from "./email.service.js";
import { buildOtpEmailTemplate } from "./emailTemplates/otpEmail.template.js";
import { sendSms } from "./smsProviders.js";

type SendOtpInput = {
  target: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  otp: string;
  expiresInSeconds: number;
};

// SMS không dấu để giữ 1 tin (160 ký tự) và tránh lỗi hiển thị.
const buildOtpSms = (otp: string, expiresInSeconds: number) =>
  `Ma xac thuc Hospital Booking cua ban la ${otp}. Het han sau ${Math.round(
    expiresInSeconds / 60,
  )} phut. Khong chia se ma nay cho bat ky ai.`;

class OtpSenderService {
  async send(input: SendOtpInput) {
    if (input.channel === "EMAIL") {
      const template = buildOtpEmailTemplate({
        otp: input.otp,
        purpose: input.purpose,
        expiresInSeconds: input.expiresInSeconds,
      });

      await EmailService.sendMail({
        to: input.target,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      return;
    }

    if (isSmsProviderConfigured() && !isDemoOtpPhone(input.target)) {
      await sendSms(input.target, buildOtpSms(input.otp, input.expiresInSeconds));
      return;
    }

    if (isLocalOtpDebugEnabled() || isDemoOtpPhone(input.target)) {
      console.log(
        `[OTP_DEBUG_SMS] phone=${input.target} purpose=${input.purpose} otp=${input.otp}`,
      );
      return;
    }

    throw new AppError(
      "Chưa cấu hình nhà cung cấp SMS để gửi OTP",
      500,
      "SMS_PROVIDER_UNAVAILABLE",
    );
  }
}

export default new OtpSenderService();

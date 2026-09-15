import { Resend } from "resend";
import { AppError } from "../utils/appError.js";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

class EmailService {
  private getResendClient() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new AppError(
        "RESEND_API_KEY chưa được cấu hình",
        500,
      );
    }

    return new Resend(apiKey);
  }

  async sendMail(input: SendMailInput) {
    const resend = this.getResendClient();

    const from =
      process.env.RESEND_FROM ||
      "Hospital Booking <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      throw new AppError(
        error.message || "Resend gửi email không thành công",
        502,
      );
    }
  }
}

export default new EmailService();
import { Router } from "express";
import {
  getPublicChatbotSettingsHandler,
  sendChatbotFeedbackHandler,
  sendChatbotMessageHandler,
} from "../controllers/chatbot.controller.js";
import { chatbotMessageLimiter, chatbotSessionBurstLimiter, chatbotSessionDailyLimiter } from "../middlewares/publicRateLimits.js";
import { optionalAuthPatient } from "../middlewares/patientAuth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { chatbotFeedbackSchema, chatbotMessageSchema } from "../validations/chatbot.validation.js";

const router = Router();

router.get("/settings", getPublicChatbotSettingsHandler);
// Xác thực tùy chọn chạy trước giới hạn tần suất: người đã đăng nhập được tính hạn mức theo tài khoản (web gọi qua máy chủ Next
// nên mọi người dùng web cùng một IP), khách tính theo IP. Token có nhưng sai/hết hạn trả 401 để client làm mới token.
router.post(
  "/message",
  optionalAuthPatient,
  chatbotMessageLimiter,
  chatbotSessionBurstLimiter,
  chatbotSessionDailyLimiter,
  validate(chatbotMessageSchema),
  sendChatbotMessageHandler,
);

router.post("/feedback", chatbotMessageLimiter, validate(chatbotFeedbackSchema), sendChatbotFeedbackHandler);

export default router;

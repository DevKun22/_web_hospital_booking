import { Router } from "express";
import {
  getPublicChatbotSettingsHandler,
  sendChatbotFeedbackHandler,
  sendChatbotMessageHandler,
} from "../controllers/chatbot.controller.js";
import { chatbotMessageLimiter, chatbotSessionBurstLimiter, chatbotSessionDailyLimiter } from "../middlewares/publicRateLimits.js";
import { validate } from "../middlewares/validate.middleware.js";
import { chatbotFeedbackSchema, chatbotMessageSchema } from "../validations/chatbot.validation.js";

const router = Router();

router.get("/settings", getPublicChatbotSettingsHandler);
router.post(
  "/message",
  chatbotMessageLimiter,
  chatbotSessionBurstLimiter,
  chatbotSessionDailyLimiter,
  validate(chatbotMessageSchema),
  sendChatbotMessageHandler,
);

router.post("/feedback", chatbotMessageLimiter, validate(chatbotFeedbackSchema), sendChatbotFeedbackHandler);

export default router;

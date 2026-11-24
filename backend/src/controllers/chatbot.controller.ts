import type { Request, Response } from "express";
import ChatbotService from "../services/chatbot/chatbot.service.js";
import ChatbotSettingsService from "../services/chatbot/chatbot.settings.js";

export const getPublicChatbotSettingsHandler = async (
  _req: Request,
  res: Response,
) => {
  const settings = await ChatbotSettingsService.getRuntimeSettings();
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  // Công khai chỉ trả điều giao diện cần để biết Kun có đang trả lời không; không lộ mã cấu hình, mô hình AI hay thời hạn phiên.
  return res.json({
    success: true,
    data: {
      isActive: settings.isActive,
      value: {
        aiEnabled: settings.value.aiEnabled,
        faqEnabled: settings.value.faqEnabled,
        fallbackEnabled: settings.value.fallbackEnabled,
      },
    },
  });
};

export const sendChatbotMessageHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await ChatbotService.handleMessage(req.body);

  return res.json({
    success: true,
    data: result,
  });
};

export const sendChatbotFeedbackHandler = async (req: Request, res: Response) => {
  await ChatbotService.recordFeedback(req.body);
  return res.json({ success: true, data: { recorded: true } });
};

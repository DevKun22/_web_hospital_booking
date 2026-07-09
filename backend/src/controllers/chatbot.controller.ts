import type { Request, Response, NextFunction } from "express";
import ChatbotService from "../services/chatbot/chatbot.service.js";
import ChatbotSettingsService from "../services/chatbot/chatbot.settings.js";

export const getPublicChatbotSettingsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await ChatbotSettingsService.getRuntimeSettings();
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

export const sendChatbotMessageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await ChatbotService.handleMessage(req.body);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

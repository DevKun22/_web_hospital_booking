import type { Request, Response, NextFunction } from "express";
import DashboardChatbotService from "../services/dashboardChatbot.service.js";
import ChatbotSettingsService from "../services/chatbot/chatbot.settings.js";
import KnowledgeService from "../services/chatbot/rag/knowledge.service.js";
import { AppError } from "../utils/appError.js";

const parseBooleanQuery = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const parseNumberQuery = (value: unknown) => {
  if (typeof value !== "string") return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const parseDateQuery = (value: unknown, endOfDay = false) => {
  if (typeof value !== "string") return undefined;

  const date = new Date(
    endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getParam = (value: string | string[] | undefined) => {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError("Thiếu id", 400);
  }

  return param;
};

export const getDashboardChatbotKnowledgeHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, data: await KnowledgeService.stats() });
  } catch (error) {
    next(error);
  }
};

export const syncDashboardChatbotKnowledgeHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await KnowledgeService.sync();
    return res.json({ success: true, data: { ...result, stats: await KnowledgeService.stats() } });
  } catch (error) {
    next(error);
  }
};

export const getDashboardChatbotOverviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const overview = await DashboardChatbotService.getOverview({
      from: parseDateQuery(req.query.dateFrom),
      to: parseDateQuery(req.query.dateTo, true),
    });

    return res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardChatbotSettingsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await ChatbotSettingsService.getRuntimeSettings();

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDashboardChatbotSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const settings = await ChatbotSettingsService.updateRuntimeSettings(
      req.body,
    );

    return res.json({
      success: true,
      message: "Cập nhật cấu hình chatbot thành công",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

export const listDashboardChatbotLogsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await DashboardChatbotService.listLogs({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      sessionId:
        typeof req.query.sessionId === "string"
          ? req.query.sessionId
          : undefined,
      guestPhone:
        typeof req.query.guestPhone === "string"
          ? req.query.guestPhone
          : undefined,
      intent:
        typeof req.query.intent === "string" ? req.query.intent : undefined,
      dateFrom: parseDateQuery(req.query.dateFrom),
      dateTo: parseDateQuery(req.query.dateTo, true),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listDashboardChatbotSessionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await DashboardChatbotService.listSessions({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      guestPhone:
        typeof req.query.guestPhone === "string"
          ? req.query.guestPhone
          : undefined,
      intent:
        typeof req.query.intent === "string" ? req.query.intent : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      isActive: parseBooleanQuery(req.query.isActive),
      dateFrom: parseDateQuery(req.query.dateFrom),
      dateTo: parseDateQuery(req.query.dateTo, true),
      page: parseNumberQuery(req.query.page),
      limit: parseNumberQuery(req.query.limit),
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardChatbotSessionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await DashboardChatbotService.getSessionById(
      getParam(req.params.id),
    );

    return res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

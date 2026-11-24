import type { Request, Response } from "express";
import DashboardChatbotService from "../services/dashboardChatbot.service.js";
import ChatbotSettingsService from "../services/chatbot/chatbot.settings.js";
import KnowledgeService from "../services/chatbot/rag/knowledge.service.js";
import { getRequiredPathParam, parseStringQuery } from "../shared/http/requestParsers.js";

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


export const getDashboardChatbotKnowledgeHandler = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await KnowledgeService.stats() });
};

export const syncDashboardChatbotKnowledgeHandler = async (_req: Request, res: Response) => {
  const result = await KnowledgeService.sync();
  return res.json({ success: true, data: { ...result, stats: await KnowledgeService.stats() } });
};

export const getDashboardChatbotOverviewHandler = async (
  req: Request,
  res: Response,
) => {
  const overview = await DashboardChatbotService.getOverview({
    from: parseDateQuery(req.query.dateFrom),
    to: parseDateQuery(req.query.dateTo, true),
  });

  return res.json({
    success: true,
    data: overview,
  });
};

export const getDashboardChatbotSettingsHandler = async (
  _req: Request,
  res: Response,
) => {
  const settings = await ChatbotSettingsService.getRuntimeSettings();

  return res.json({
    success: true,
    data: settings,
  });
};

export const updateDashboardChatbotSettingsHandler = async (
  req: Request,
  res: Response,
) => {
  const settings = await ChatbotSettingsService.updateRuntimeSettings(
    req.body,
  );

  return res.json({
    success: true,
    message: "Cập nhật cấu hình chatbot thành công",
    data: settings,
  });
};

export const listDashboardChatbotLogsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DashboardChatbotService.listLogs({
    search:
      parseStringQuery(req.query.search),
    sessionId:
      parseStringQuery(req.query.sessionId),
    guestPhone:
      parseStringQuery(req.query.guestPhone),
    intent:
      parseStringQuery(req.query.intent),
    dateFrom: parseDateQuery(req.query.dateFrom),
    dateTo: parseDateQuery(req.query.dateTo, true),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({
    success: true,
    data: result,
  });
};

export const listDashboardChatbotSessionsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DashboardChatbotService.listSessions({
    search:
      parseStringQuery(req.query.search),
    guestPhone:
      parseStringQuery(req.query.guestPhone),
    intent:
      parseStringQuery(req.query.intent),
    state: parseStringQuery(req.query.state),
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
};

export const getDashboardChatbotSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const session = await DashboardChatbotService.getSessionById(
    getRequiredPathParam(req.params.id),
  );

  return res.json({
    success: true,
    data: session,
  });
};

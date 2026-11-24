import { Router } from "express";
import {
  getDashboardChatbotKnowledgeHandler,
  getDashboardChatbotOverviewHandler,
  getDashboardChatbotSettingsHandler,
  getDashboardChatbotSessionHandler,
  getDashboardChatbotTraceHandler,
  listDashboardChatbotLogsHandler,
  listDashboardChatbotSessionsHandler,
  syncDashboardChatbotKnowledgeHandler,
  updateDashboardChatbotSettingsHandler,
} from "../controllers/dashboardChatbot.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateDashboardChatbotSettingsSchema } from "../validations/dashboardChatbotSetting.validation.js";

const router = Router();

router.use(authDashboard, requirePermission("chatbot.view"));

router.get("/overview", getDashboardChatbotOverviewHandler);
router.get("/settings", getDashboardChatbotSettingsHandler);
router.patch(
  "/settings",
  requirePermission("chatbot.config"),
  validate(updateDashboardChatbotSettingsSchema),
  updateDashboardChatbotSettingsHandler,
);
router.get("/knowledge", getDashboardChatbotKnowledgeHandler);
router.post("/knowledge/sync", requirePermission("chatbot.config"), syncDashboardChatbotKnowledgeHandler);
router.get("/logs", listDashboardChatbotLogsHandler);
// Xem vết xử lý (debug) của một lượt theo traceId; cùng quyền chatbot.view với nhật ký.
router.get("/traces/:traceId", getDashboardChatbotTraceHandler);
router.get("/sessions", listDashboardChatbotSessionsHandler);
router.get("/sessions/:id", getDashboardChatbotSessionHandler);

export default router;

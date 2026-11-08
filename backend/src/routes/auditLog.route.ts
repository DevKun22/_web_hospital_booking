import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import AuditLogService from "../services/auditLog.service.js";

const router = Router();

router.use(authDashboard, requirePermission("audit.view"));

const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
const date = (value: unknown) => {
  const parsed = typeof value === "string" ? new Date(value) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
};

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AuditLogService.list({
      page: Number(req.query.page) || undefined,
      limit: Number(req.query.limit) || undefined,
      action: text(req.query.action),
      actorId: text(req.query.actorId),
      from: date(req.query.from),
      to: date(req.query.to),
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;

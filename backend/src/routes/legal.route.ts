import { Router } from "express";
import { getLegalHandler, updateLegalHandler } from "../controllers/legal.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateLegalSchema } from "../validations/legal.validation.js";

export const publicLegalRouter = Router();
publicLegalRouter.get("/", getLegalHandler);

export const dashboardLegalRouter = Router();
dashboardLegalRouter.use(authDashboard);
dashboardLegalRouter.get("/", requirePermission("settings.view"), getLegalHandler);
dashboardLegalRouter.put("/", requirePermission("settings.edit"), validate(updateLegalSchema), updateLegalHandler);

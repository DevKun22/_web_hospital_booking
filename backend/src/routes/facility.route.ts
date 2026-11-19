import { Router } from "express";
import {
  createFacilityHandler,
  deleteFacilityHandler,
  listFacilitiesHandler,
  listPublicFacilitiesHandler,
  updateFacilityHandler,
} from "../controllers/facility.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createFacilitySchema, updateFacilitySchema } from "../validations/facility.validation.js";

export const publicFacilityRouter = Router();
publicFacilityRouter.get("/", listPublicFacilitiesHandler);

export const dashboardFacilityRouter = Router();
dashboardFacilityRouter.use(authDashboard);
dashboardFacilityRouter.get("/", requirePermission("catalog.view"), listFacilitiesHandler);
dashboardFacilityRouter.post("/", requirePermission("catalog.manage"), validate(createFacilitySchema), createFacilityHandler);
dashboardFacilityRouter.patch("/:id", requirePermission("catalog.manage"), validate(updateFacilitySchema), updateFacilityHandler);
dashboardFacilityRouter.delete("/:id", requirePermission("catalog.delete"), deleteFacilityHandler);

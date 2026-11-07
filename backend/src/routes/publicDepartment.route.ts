import { Router } from "express";
import {
  getPublicDepartmentHandler,
  getPublicDepartmentOverviewHandler,
  listPublicDepartmentCatalogHandler,
  listPublicDepartmentsHandler,
} from "../controllers/publicDepartment.controller.js";

const router = Router();

router.get("/", listPublicDepartmentsHandler);
router.get("/catalog", listPublicDepartmentCatalogHandler);
router.get("/:slug/overview", getPublicDepartmentOverviewHandler);
router.get("/:slug", getPublicDepartmentHandler);

export default router;

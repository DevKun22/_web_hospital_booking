import { Router } from "express";
import {
  getPublicPackageHandler,
  listPublicPackageCatalogHandler,
  listPublicPackagesHandler,
} from "../controllers/package.controller.js";

const router = Router();

router.get("/", listPublicPackagesHandler);
router.get("/catalog", listPublicPackageCatalogHandler);
router.get("/:slug", getPublicPackageHandler);

export default router;

import { Router } from "express";
import { getPublicBootstrapHandler } from "../controllers/publicBootstrap.controller.js";

const router = Router();

router.get("/bootstrap", getPublicBootstrapHandler);

export default router;

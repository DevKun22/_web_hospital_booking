import { Router } from "express";
import { publicSearchHandler } from "../controllers/search.controller.js";
import { searchLimiter } from "../middlewares/publicRateLimits.js";

const router = Router();

router.get("/", searchLimiter, publicSearchHandler);

export default router;

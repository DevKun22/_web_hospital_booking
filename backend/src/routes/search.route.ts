import { Router } from "express";
import { publicSearchHandler } from "../controllers/search.controller.js";

const router = Router();

router.get("/", publicSearchHandler);

export default router;

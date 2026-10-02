import { Router } from "express";
import { patientCapabilitiesHandler } from "../controllers/patientPortalV1.controller.js";
import patientAuthRouter from "./patientAuthV1.route.js";
import patientPortalRouter from "./patientPortalV1.route.js";

const router = Router();

router.get("/capabilities", patientCapabilitiesHandler);
router.use("/auth", patientAuthRouter);
router.use("/me", patientPortalRouter);

export default router;

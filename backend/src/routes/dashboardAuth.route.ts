import { Router } from "express";

import { validate } from "../middlewares/validate.middleware.js";

import {
  loginHandler,
  verifyOtpHandler,
  meHandler,
  refreshHandler,
  logoutHandler,
  changePasswordHandler,
} from "../controllers/dashboardAuth.controller.js";

import {
  dashboardLoginSchema,
  dashboardVerifyOtpSchema,
  dashboardChangePasswordSchema,
} from "../validations/dashboardAuth.validation.js";

import { authDashboardAllowPasswordChange } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", validate(dashboardLoginSchema), loginHandler);

router.post(
  "/verify-otp",
  validate(dashboardVerifyOtpSchema),
  verifyOtpHandler,
);

router.post("/refresh", refreshHandler);

router.get("/me", authDashboardAllowPasswordChange, meHandler);

router.post(
  "/change-password",
  authDashboardAllowPasswordChange,
  validate(dashboardChangePasswordSchema),
  changePasswordHandler,
);

router.post("/logout", logoutHandler);

export default router;

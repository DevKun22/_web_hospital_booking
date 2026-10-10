import { Router } from "express";
import {
  cancelPaymentTransactionHandler,
  createPaymentTransactionHandler,
  getMockCheckoutHandler,
  getPaymentCapabilitiesHandler,
  getPaymentTransactionHandler,
  mockPaymentFailHandler,
  mockPaymentSuccessHandler,
  paymentProviderReturnHandler,
  paymentProviderWebhookHandler,
} from "../controllers/payment.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createPaymentTransactionSchema } from "../validations/payment.validation.js";
import { requireLookupGrant } from "../middlewares/lookupGrant.middleware.js";

const router = Router();

router.get(
  "/capabilities",
  requireLookupGrant("payments:write"),
  getPaymentCapabilitiesHandler,
);

router.post(
  "/invoices/:invoiceId/create",
  requireLookupGrant("payments:write"),
  validate(createPaymentTransactionSchema),
  createPaymentTransactionHandler,
);
router.get(
  "/:id",
  requireLookupGrant("invoices:read"),
  getPaymentTransactionHandler,
);
router.patch(
  "/:id/cancel",
  requireLookupGrant("payments:write"),
  cancelPaymentTransactionHandler,
);

router.get(
  "/mock/checkout/:transactionCode",
  requireLookupGrant("invoices:read"),
  getMockCheckoutHandler,
);
router.post(
  "/mock/:transactionCode/success",
  requireLookupGrant("payments:write"),
  mockPaymentSuccessHandler,
);
router.post(
  "/mock/:transactionCode/fail",
  requireLookupGrant("payments:write"),
  mockPaymentFailHandler,
);

router.post("/:provider/webhook", paymentProviderWebhookHandler);
router.get("/:provider/return", paymentProviderReturnHandler);

export default router;

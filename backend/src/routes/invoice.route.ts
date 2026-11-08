import { Router } from "express";
import {
  cancelInvoiceHandler,
  createInvoiceForAppointmentHandler,
  getInvoiceHandler,
  listInvoicesHandler,
  payInvoiceHandler,
  refundInvoiceHandler,
  refundInvoiceViaVnpayHandler,
  updateInvoiceHandler,
} from "../controllers/invoice.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createInvoiceSchema,
  payInvoiceSchema,
  refundInvoiceSchema,
  refundInvoiceViaVnpaySchema,
  updateInvoiceSchema,
} from "../validations/invoice.validation.js";

const router = Router();

router.use(authDashboard);

router.get("/", requirePermission("invoice.view"), listInvoicesHandler);
router.post(
  "/appointments/:appointmentId",
  requirePermission("invoice.manage"),
  validate(createInvoiceSchema),
  createInvoiceForAppointmentHandler,
);
router.get("/:id", requirePermission("invoice.view"), getInvoiceHandler);
router.patch(
  "/:id",
  requirePermission("invoice.manage"),
  validate(updateInvoiceSchema),
  updateInvoiceHandler,
);
router.patch(
  "/:id/pay",
  requirePermission("invoice.collect"),
  validate(payInvoiceSchema),
  payInvoiceHandler,
);
router.patch(
  "/:id/cancel",
  requirePermission("invoice.manage"),
  cancelInvoiceHandler,
);
router.patch(
  "/:id/refund",
  requirePermission("invoice.refund"),
  validate(refundInvoiceSchema),
  refundInvoiceHandler,
);

router.post(
  "/:id/refund/vnpay",
  requirePermission("invoice.refund"),
  validate(refundInvoiceViaVnpaySchema),
  refundInvoiceViaVnpayHandler,
);

export default router;

import { Router } from "express";
import {
  cancelInvoiceHandler,
  createInvoiceForAppointmentHandler,
  getInvoiceHandler,
  listInvoicesHandler,
  payInvoiceHandler,
  paySupplementHandler,
  listRefundableMedicineHandler,
  recordMedicineRefundHandler,
  refundInvoiceHandler,
  refundInvoiceViaVnpayHandler,
  updateInvoiceHandler,
} from "../controllers/invoice.controller.js";
import { exportInvoicesHandler } from "../controllers/dataExport.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createInvoiceSchema,
  payInvoiceSchema,
  refundInvoiceSchema,
  refundInvoiceViaVnpaySchema,
  refundMedicineSchema,
  updateInvoiceSchema,
} from "../validations/invoice.validation.js";

const router = Router();

router.use(authDashboard);

router.get("/", requirePermission("invoice.view"), listInvoicesHandler);
// Phải đứng trước "/:id" để "export" không bị hiểu là mã hóa đơn.
router.get("/export", requirePermission("invoice.view"), exportInvoicesHandler);
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
// Thu tại quầy hóa đơn bổ sung tiền thuốc (đơn phát hành sau khi hóa đơn chính đã thanh toán).
router.patch(
  "/:id/supplements/:supplementId/pay",
  requirePermission("invoice.collect"),
  validate(payInvoiceSchema),
  paySupplementHandler,
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

// Hoàn một phần tiền thuốc không được cấp: xem các dòng chờ hoàn và ghi nhận đã hoàn.
router.get(
  "/:id/medicine-refund",
  requirePermission("invoice.refund"),
  listRefundableMedicineHandler,
);
router.post(
  "/:id/medicine-refund",
  requirePermission("invoice.refund"),
  validate(refundMedicineSchema),
  recordMedicineRefundHandler,
);

export default router;

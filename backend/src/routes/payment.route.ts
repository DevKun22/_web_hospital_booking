import { Router } from "express";
import {
  paymentProviderReturnHandler,
  paymentProviderWebhookHandler,
  vnpayIpnHandler,
  vnpayReturnHandler,
} from "../controllers/payment.controller.js";

// Chỉ còn callback từ cổng thanh toán. Tạo/xem giao dịch đi qua /api/v1/me.
const router = Router();

router.get("/vnpay/return", vnpayReturnHandler);
router.get("/vnpay/ipn", vnpayIpnHandler);
router.post("/:provider/webhook", paymentProviderWebhookHandler);
router.get("/:provider/return", paymentProviderReturnHandler);

export default router;

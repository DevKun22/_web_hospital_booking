import { Router } from "express";
import {
  vnpayIpnHandler,
  vnpayReturnHandler,
} from "../controllers/payment.controller.js";

// Chỉ còn callback từ VNPay. Tạo/xem giao dịch đi qua /api/v1/me.
const router = Router();

router.get("/vnpay/return", vnpayReturnHandler);
router.get("/vnpay/ipn", vnpayIpnHandler);

export default router;

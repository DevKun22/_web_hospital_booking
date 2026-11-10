import { Router } from "express";
import {
  getStaffInboxUnreadCountHandler,
  listStaffInboxHandler,
  markAllStaffInboxReadHandler,
  markStaffInboxReadHandler,
} from "../controllers/staffInbox.controller.js";
import { authDashboard } from "../middlewares/auth.middleware.js";

// Hộp thư của chính người đăng nhập: mọi vai trò nhân sự đều có, không cần quyền riêng.
const router = Router();

router.use(authDashboard);
router.get("/", listStaffInboxHandler);
router.get("/unread-count", getStaffInboxUnreadCountHandler);
router.patch("/read-all", markAllStaffInboxReadHandler);
router.patch("/:id/read", markStaffInboxReadHandler);

export default router;

import type { Request } from "express";
import type { AuditAction } from "../services/auditLog.service.js";
import AuditLogService from "../services/auditLog.service.js";
import { getClientIp } from "./clientIp.js";

// Bác sĩ điều trị xem bệnh án của mình là công việc hằng ngày nên không ghi. Mọi vai trò
// khác xem chi tiết dữ liệu y tế (ví dụ quản trị được cấp quyền xem) đều để lại dấu vết.
export const auditClinicalView = async (
  req: Request,
  action: Extract<AuditAction, "MEDICAL_RECORD_VIEWED" | "PRESCRIPTION_VIEWED">,
  targetType: "MEDICAL_RECORD" | "PRESCRIPTION",
  targetId: string,
) => {
  if (!req.user || req.user.role === "DOCTOR") return;
  await AuditLogService.record({
    actor: { userId: req.user.userId, role: req.user.role },
    action,
    targetType,
    targetId,
    ipAddress: getClientIp(req),
  });
};

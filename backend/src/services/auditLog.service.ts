import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

// Nhật ký truy cập và thao tác nhạy cảm. Khác với AppointmentLog (gắn với một lịch hẹn và
// hiện trên dòng thời gian lịch), đây là nhật ký bảo mật chỉ quản trị đọc.
// Không ghi nội dung y tế: chỉ ai, làm gì, trên đối tượng nào, từ đâu.
export const AUDIT_ACTIONS = [
  "USER_CREATED",
  "USER_UPDATED",
  "USER_STATUS_CHANGED",
  "USER_PASSWORD_RESET",
  "PASSWORD_CHANGED",
  "RBAC_MATRIX_UPDATED",
  "RBAC_MATRIX_RESET",
  "MEDICAL_RECORD_VIEWED",
  "PRESCRIPTION_VIEWED",
  "INVOICE_ADJUSTED",
  "INVOICE_REFUNDED",
  "INVOICE_REFUND_UNVERIFIED",
  "DATA_EXPORTED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditActor = { userId: string; role: string };

type AuditInput = {
  actor: AuditActor | null | undefined;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  meta?: Prisma.InputJsonObject;
};

class AuditLogService {
  // Ghi một dòng nhật ký. Truyền `client` (transaction) để ghi cùng thao tác gốc.
  async record(input: AuditInput, client: Prisma.TransactionClient = prisma) {
    const actorName = input.actor
      ? (
          await client.user.findUnique({
            where: { id: input.actor.userId },
            select: { fullName: true },
          })
        )?.fullName
      : undefined;

    return client.auditLog.create({
      data: {
        actorId: input.actor?.userId,
        actorName,
        actorRole: input.actor?.role,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ipAddress: input.ipAddress,
        meta: input.meta,
      },
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    action?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
  }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const where: Prisma.AuditLogWhereInput = {
      action: query.action || undefined,
      actorId: query.actorId || undefined,
      createdAt:
        query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export default new AuditLogService();
